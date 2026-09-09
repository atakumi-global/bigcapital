import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { BankFeedItem } from '../../BankingFeeds/models/BankFeedItem';
import { BankFeedSyncDb } from '../../BankingFeeds/BankFeedSyncDb';
import {
  BankFeedProvider,
  BankFeedTransaction,
} from '../../BankingFeeds/BankFeedProvider.types';
import { UncategorizedBankTransaction } from '../../BankingTransactions/models/UncategorizedBankTransaction';
import { WiseAuthError } from '../../Wise/Wise.errors';
import { WiseBankFeedProvider } from '../WiseBankFeedProvider';
import { transformWiseAccountToCreateAccount } from '../BankingWise.utils';

@Injectable()
export class WiseUpdateTransactions {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly wiseBankFeedProvider: WiseBankFeedProvider,
    private readonly bankFeedSyncDb: BankFeedSyncDb,

    @Inject(BankFeedItem.name)
    private readonly bankFeedItemModel: TenantModelProxy<typeof BankFeedItem>,

    @Inject(UncategorizedBankTransaction.name)
    private readonly uncategorizedBankTransactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  /**
   * Syncs the Wise balances and statement transactions of the given item into
   * the chart of accounts and the uncategorized bank transactions.
   * @param {string} providerItemId - Wise profile id.
   * @returns {Promise<void>}
   */
  public async sync(providerItemId: string): Promise<void> {
    try {
      await this.uow.withTransaction(async (trx: Knex.Transaction) => {
        // Locks the item row to prevent concurrent syncs of the same item.
        const item = await this.bankFeedItemModel()
          .query(trx)
          .findOne({
            provider: BankFeedProvider.Wise,
            providerItemId,
          })
          .forUpdate();

        // Skip when the item was disconnected or paused.
        if (!item || item.isPaused) {
          return;
        }
        const { accounts } =
          await this.wiseBankFeedProvider.fetchAccounts(item);
        const createAccountDTOs = accounts.map((account) =>
          transformWiseAccountToCreateAccount(account, providerItemId),
        );
        await this.bankFeedSyncDb.syncBankAccounts(createAccountDTOs, trx);

        const updates =
          await this.wiseBankFeedProvider.fetchTransactionUpdates(item);
        const freshTransactions = await this.filterExistingTransactions(
          updates.added,
          trx,
        );
        await this.bankFeedSyncDb.syncAccountsTransactions(
          BankFeedProvider.Wise,
          freshTransactions,
          trx,
        );
        await this.bankFeedSyncDb.syncTransactionsCursor(
          BankFeedProvider.Wise,
          providerItemId,
          null,
          updates.syncState,
          trx,
        );
        const providerAccountIds = accounts.map(
          (account) => account.providerAccountId,
        );
        await this.bankFeedSyncDb.updateLastFeedsUpdatedAt(
          BankFeedProvider.Wise,
          providerAccountIds,
          trx,
        );
        await this.bankFeedSyncDb.updateAccountsFeedsActive(
          BankFeedProvider.Wise,
          providerAccountIds,
          true,
          trx,
        );
      });
    } catch (error) {
      // An auth error is non-retryable: flag the item and exit quietly so the
      // cron keeps the other tenants flowing.
      if (error instanceof WiseAuthError) {
        await this.bankFeedItemModel()
          .query()
          .findOne({
            provider: BankFeedProvider.Wise,
            providerItemId,
          })
          .patch({ status: 'error' });
        return;
      }
      throw error;
    }
  }

  /**
   * Filters out the transactions that were already synced. Application-level
   * idempotency: there is no unique index on the neutral transaction id
   * columns (existing rows were never unique), so duplicates are excluded by
   * querying the batch ids against `uct_feed_provider_tx_idx` before insert.
   * @param {BankFeedTransaction[]} transactions - Fetched transactions.
   * @param {Knex.Transaction} trx - Knex transaction.
   * @returns {Promise<BankFeedTransaction[]>}
   */
  private async filterExistingTransactions(
    transactions: BankFeedTransaction[],
    trx: Knex.Transaction,
  ): Promise<BankFeedTransaction[]> {
    if (!transactions.length) {
      return transactions;
    }
    const providerTransactionIds = transactions.map(
      (transaction) => transaction.providerTransactionId,
    );
    const existingTransactions = await this.uncategorizedBankTransactionModel()
      .query(trx)
      .where({ bankFeedProvider: BankFeedProvider.Wise })
      .whereIn('bankFeedProviderTransactionId', providerTransactionIds)
      .select('bankFeedProviderTransactionId');

    const existingIds = new Set(
      existingTransactions.map(
        (transaction) => transaction.bankFeedProviderTransactionId,
      ),
    );
    return transactions.filter(
      (transaction) => !existingIds.has(transaction.providerTransactionId),
    );
  }
}
