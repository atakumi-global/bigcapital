import * as bluebird from 'bluebird';
import * as uniqid from 'uniqid';
import { entries, groupBy } from 'lodash';
import { Knex } from 'knex';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject, Injectable } from '@nestjs/common';
import { IAccountCreateDTO } from '@/interfaces/Account';
import { CreateAccountService } from '../Accounts/CreateAccount.service';
import { Account } from '../Accounts/models/Account.model';
import { events } from '@/common/events/events';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';
import { CreateUncategorizedTransactionService } from '@/modules/BankingCategorize/commands/CreateUncategorizedTransaction.service';
import { CreateUncategorizedTransactionDTO } from '../BankingCategorize/types/BankingCategorize.types';
import { RemovePendingUncategorizedTransaction } from '../BankingTransactions/commands/RemovePendingUncategorizedTransaction.service';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { BankFeedItem } from './models/BankFeedItem';
import {
  BankFeedProvider,
  BankFeedTransaction,
  IBankFeedTransactionsSyncedEventPayload,
} from './BankFeedProvider.types';

const CONCURRENCY_ASYNC = 10;

export const transformBankFeedTrxToCashflowCreate = (
  cashflowAccountId: number,
  bankFeedTransaction: BankFeedTransaction,
): CreateUncategorizedTransactionDTO => {
  const isPlaid = bankFeedTransaction.provider === BankFeedProvider.Plaid;

  return {
    date: bankFeedTransaction.date,
    amount: bankFeedTransaction.amount,
    description: bankFeedTransaction.description,
    payee: bankFeedTransaction.payee,
    currencyCode: bankFeedTransaction.currencyCode,
    accountId: cashflowAccountId,
    referenceNo: bankFeedTransaction.referenceNo,
    pending: bankFeedTransaction.pending,

    bankFeedProvider: bankFeedTransaction.provider,
    bankFeedProviderTransactionId:
      bankFeedTransaction.providerTransactionId,
    pendingBankFeedProviderTransactionId:
      bankFeedTransaction.pendingProviderTransactionId,

    // Deprecated Plaid aliases kept while old readers/writers migrate.
    plaidTransactionId: isPlaid
      ? bankFeedTransaction.providerTransactionId
      : undefined,
    pendingPlaidTransactionId: isPlaid
      ? bankFeedTransaction.pendingProviderTransactionId
      : undefined,
  };
};

@Injectable()
export class BankFeedSyncDb {
  constructor(
    private readonly createAccountService: CreateAccountService,
    private readonly createUncategorizedTransaction: CreateUncategorizedTransactionService,
    private readonly removePendingTransaction: RemovePendingUncategorizedTransaction,
    private readonly eventPublisher: EventEmitter2,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,

    @Inject(UncategorizedBankTransaction.name)
    private readonly uncategorizedBankTransactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,

    @Inject(BankFeedItem.name)
    private readonly bankFeedItemModel: TenantModelProxy<typeof BankFeedItem>,
  ) {}

  /**
   * Syncs one provider bank account to the chart of accounts.
   */
  public async syncBankAccount(
    createBankAccountDTO: IAccountCreateDTO,
    trx?: Knex.Transaction,
  ) {
    const feedAccount = await this.accountModel()
      .query(trx)
      .findOne({
        bankFeedProvider: createBankAccountDTO.bankFeedProvider,
        bankFeedProviderAccountId:
          createBankAccountDTO.bankFeedProviderAccountId,
      });

    // Can't continue if the provider account is already created.
    if (feedAccount) {
      return;
    }
    await this.createAccountService.createAccount(createBankAccountDTO, trx, {
      ignoreUniqueName: true,
    });
  }

  /**
   * Syncs provider bank accounts to system accounts.
   */
  public async syncBankAccounts(
    createBankAccountDTOs: IAccountCreateDTO[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    await bluebird.map(
      createBankAccountDTOs,
      (createAccountDTO: IAccountCreateDTO) =>
        this.syncBankAccount(createAccountDTO, trx),
      { concurrency: CONCURRENCY_ASYNC },
    );
  }

  /**
   * Syncs provider transactions of one account to uncategorized cashflow transactions.
   */
  public async syncAccountTransactions(
    provider: BankFeedProvider | string,
    providerAccountId: string,
    bankFeedTransactions: BankFeedTransaction[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const batch = uniqid();
    const cashflowAccount = await this.accountModel()
      .query(trx)
      .findOne({
        bankFeedProvider: provider,
        bankFeedProviderAccountId: providerAccountId,
      })
      .throwIfNotFound();

    const uncategorizedTransDTOs = bankFeedTransactions.map((transaction) =>
      transformBankFeedTrxToCashflowCreate(cashflowAccount.id, transaction),
    );

    // Creating account transaction queue.
    await bluebird.map(
      uncategorizedTransDTOs,
      (uncategoriedDTO) =>
        this.createUncategorizedTransaction.create(
          { ...uncategoriedDTO, batch },
          trx,
        ),
      { concurrency: 1 },
    );
    // Triggers `onBankFeedTransactionsSynced` event.
    await this.eventPublisher.emitAsync(events.bankFeed.onTransactionsSynced, {
      provider,
      providerAccountId,
      accountId: cashflowAccount.id,
      batch,
      trx,
    } as IBankFeedTransactionsSyncedEventPayload);
  }

  /**
   * Syncs provider transactions grouped by provider account id.
   */
  public async syncAccountsTransactions(
    provider: BankFeedProvider | string,
    bankFeedTransactions: BankFeedTransaction[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    if (!bankFeedTransactions?.length) {
      return;
    }
    const groupedTrnsxByAccountId = entries(
      groupBy(bankFeedTransactions, 'providerAccountId'),
    );
    await bluebird.map(
      groupedTrnsxByAccountId,
      ([providerAccountId, providerTransactions]: [
        string,
        BankFeedTransaction[],
      ]) => {
        return this.syncAccountTransactions(
          provider,
          providerAccountId,
          providerTransactions,
          trx,
        );
      },
      { concurrency: CONCURRENCY_ASYNC },
    );
  }

  /**
   * Syncs removed provider transaction ids from uncategorized cashflow transactions.
   */
  public async syncRemoveTransactions(
    provider: BankFeedProvider | string,
    providerTransactionIds: string[],
    trx?: Knex.Transaction,
  ) {
    if (!providerTransactionIds?.length) {
      return;
    }
    const uncategorizedTransactions =
      await this.uncategorizedBankTransactionModel()
        .query(trx)
        .where({ bankFeedProvider: provider })
        .whereIn('bankFeedProviderTransactionId', providerTransactionIds);
    const uncategorizedTransactionsIds = uncategorizedTransactions.map(
      (trans) => trans.id,
    );
    await bluebird.map(
      uncategorizedTransactionsIds,
      (uncategorizedTransactionId: number) =>
        this.removePendingTransaction.removePendingTransaction(
          uncategorizedTransactionId,
          trx,
        ),
      { concurrency: CONCURRENCY_ASYNC },
    );
  }

  /**
   * Syncs the provider item last transaction cursor/state.
   */
  public async syncTransactionsCursor(
    provider: BankFeedProvider | string,
    providerItemId: string,
    lastCursor?: string | null,
    syncState?: Record<string, any> | null,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const patch: Record<string, any> = {};
    if (typeof lastCursor !== 'undefined') {
      patch.lastCursor = lastCursor;
    }
    if (typeof syncState !== 'undefined') {
      patch.syncState = syncState;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    await this.bankFeedItemModel()
      .query(trx)
      .findOne({ provider, providerItemId })
      .patch(patch);
  }

  /**
   * Updates the last feeds updated at of the given provider account ids.
   */
  public async updateLastFeedsUpdatedAt(
    provider: BankFeedProvider | string,
    providerAccountIds: string[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    if (!providerAccountIds?.length) {
      return;
    }
    await this.accountModel()
      .query(trx)
      .where({ bankFeedProvider: provider })
      .whereIn('bankFeedProviderAccountId', providerAccountIds)
      .patch({
        lastFeedsUpdatedAt: new Date(),
      });
  }

  /**
   * Updates the accounts feed active status of the given provider account ids.
   */
  public async updateAccountsFeedsActive(
    provider: BankFeedProvider | string,
    providerAccountIds: string[],
    isFeedsActive: boolean = true,
    trx?: Knex.Transaction,
  ): Promise<void> {
    if (!providerAccountIds?.length) {
      return;
    }
    await this.accountModel()
      .query(trx)
      .where({ bankFeedProvider: provider })
      .whereIn('bankFeedProviderAccountId', providerAccountIds)
      .patch({
        isFeedsActive,
      });
  }
}
