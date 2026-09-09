import {
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankFeedAccount,
  BankFeedItemRecord,
  BankFeedProvider,
  BankFeedProviderClient,
  BankFeedTransaction,
  BankFeedTransactionUpdates,
  BankFeedWebhookEvent,
} from '../BankingFeeds/BankFeedProvider.types';
import { WiseClient } from '../Wise/Wise.client';
import { WiseBalance } from '../Wise/Wise.types';
import {
  isSyncableWiseBalance,
  transformWiseBalanceToBankFeedAccount,
  transformWiseStatementTxnToBankFeedTransaction,
} from './BankingWise.utils';

/** Initial statement window when a balance was never synced before. */
const INITIAL_SYNC_WINDOW_DAYS = 90;

/** Hard cap of the Wise balance-statement endpoint window. */
const MAX_STATEMENT_WINDOW_DAYS = 469;

export interface WiseItemSyncState {
  profileId?: number;
  balances?: Record<string, { currency: string; lastSyncedAt: string }>;
}

@Injectable()
export class WiseBankFeedProvider implements BankFeedProviderClient {
  readonly provider = BankFeedProvider.Wise;

  constructor(
    private readonly configService: ConfigService,
    private readonly wiseClient: WiseClient,
  ) {}

  private assertConfigured(): void {
    if (!this.configService.get('wise.apiToken')) {
      throw new InternalServerErrorException(
        'Wise bank feed is not configured. Set WISE_API_TOKEN, WISE_API_BASE_URL, and WISE_PROFILE_ID.',
      );
    }
  }

  /**
   * Fetches the syncable Wise balances of the item profile as provider-neutral
   * bank feed accounts.
   * @param {BankFeedItemRecord} item - Bank feed item.
   * @returns {Promise<{ institutionName?: string | null; accounts: BankFeedAccount[] }>}
   */
  async fetchAccounts(item: BankFeedItemRecord): Promise<{
    institutionName?: string | null;
    accounts: BankFeedAccount[];
  }> {
    this.assertConfigured();

    const balances = await this.listSyncableBalances(item.providerItemId);
    const accounts = balances.map(transformWiseBalanceToBankFeedAccount);

    return { institutionName: 'Wise', accounts };
  }

  /**
   * Fetches the statement transactions of each syncable balance since its last
   * sync. Wise statements are append-only, so `modified` and `removed` are
   * always empty for this provider.
   * @param {BankFeedItemRecord} item - Bank feed item.
   * @returns {Promise<BankFeedTransactionUpdates>}
   */
  async fetchTransactionUpdates(
    item: BankFeedItemRecord,
  ): Promise<BankFeedTransactionUpdates> {
    this.assertConfigured();

    const profileId = item.providerItemId;
    const balances = await this.listSyncableBalances(profileId);
    const prevSyncState = (item.syncState || {}) as WiseItemSyncState;

    const now = new Date();
    const intervalEnd = now.toISOString();

    const added: BankFeedTransaction[] = [];
    const balancesState: WiseItemSyncState['balances'] = {
      ...prevSyncState.balances,
    };
    for (const balance of balances) {
      const intervalStart = this.getBalanceIntervalStart(
        prevSyncState,
        balance,
        now,
      );
      const statement = await this.wiseClient.getBalanceStatement(
        profileId,
        balance.id,
        {
          currency: balance.currency,
          intervalStart,
          intervalEnd,
        },
      );
      const transactions = (statement.transactions || []).map((txn) =>
        transformWiseStatementTxnToBankFeedTransaction(txn, balance.id),
      );
      added.push(...transactions);

      balancesState[String(balance.id)] = {
        currency: balance.currency,
        lastSyncedAt: intervalEnd,
      };
    }
    return {
      added,
      modified: [],
      removedProviderTransactionIds: [],
      syncState: {
        profileId: Number(profileId),
        balances: balancesState,
      },
    };
  }

  verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string>,
  ): Promise<void> {
    this.assertConfigured();
    // P8: RSA-SHA256 verification of `X-Signature-SHA256` against Wise's public key.
    throw new NotImplementedException(
      'Wise webhook verification is not implemented yet.',
    );
  }

  mapWebhook(_body: any): BankFeedWebhookEvent {
    // P8: map `balances#update` payloads to transaction sync triggers.
    throw new NotImplementedException(
      'Wise webhook payload mapping is not implemented yet.',
    );
  }

  /**
   * Lists the syncable (visible, non-invested) balances of the given profile.
   * @param {string} profileId - Wise profile id.
   * @returns {Promise<WiseBalance[]>}
   */
  private async listSyncableBalances(
    profileId: number | string,
  ): Promise<WiseBalance[]> {
    const balances = await this.wiseClient.listBalances(profileId);

    return balances.filter(isSyncableWiseBalance);
  }

  /**
   * Resolves the statement window start of the given balance: the last synced
   * cursor, the initial 90-day window for new balances, hard-capped to the
   * 469-day Wise statement limit.
   */
  private getBalanceIntervalStart(
    prevSyncState: WiseItemSyncState,
    balance: WiseBalance,
    now: Date,
  ): string {
    const lastSyncedAt =
      prevSyncState.balances?.[String(balance.id)]?.lastSyncedAt;

    const initialStart = new Date(now);
    initialStart.setDate(initialStart.getDate() - INITIAL_SYNC_WINDOW_DAYS);

    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() - MAX_STATEMENT_WINDOW_DAYS);

    const start = lastSyncedAt ? new Date(lastSyncedAt) : initialStart;

    return (start < maxStart ? maxStart : start).toISOString();
  }
}
