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

/** Hard cap of the Wise balance-statement endpoint window (exact span). */
const MAX_STATEMENT_WINDOW_MS = 469 * 24 * 60 * 60 * 1000;

export interface WiseItemSyncState {
  profileId?: number;
  /** Optional import start date (ISO) overriding the default 90-day window. */
  syncStartDate?: string;
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
 *
 * The Wise statement window is capped at 469 days per request; older start
 * dates are backfilled by chaining consecutive 469-day windows.
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
    const windowStart = this.getBalanceWindowStart(
      prevSyncState,
      balance,
      now,
    );
    // Chain consecutive windows of at most 469 days until now.
    for (
      let intervalStart = windowStart;
      intervalStart < now;
      intervalStart = new Date(intervalStart.getTime() + MAX_STATEMENT_WINDOW_MS)
    ) {
      const windowEnd = this.minDate(
        new Date(intervalStart.getTime() + MAX_STATEMENT_WINDOW_MS),
        now,
      );
      const statement = await this.wiseClient.getBalanceStatement(
        profileId,
        balance.id,
        {
          currency: balance.currency,
          intervalStart: intervalStart.toISOString(),
          intervalEnd: windowEnd.toISOString(),
        },
      );
      const transactions = (statement.transactions || []).map((txn) =>
        transformWiseStatementTxnToBankFeedTransaction(txn, balance.id),
      );
      added.push(...transactions);
    }
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
      ...prevSyncState,
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
   * Resolves the backfill window start of the given balance: the last synced
   * cursor, the configured `syncStartDate`, or the initial 90-day window for
   * new balances.
   */
  private getBalanceWindowStart(
    prevSyncState: WiseItemSyncState,
    balance: WiseBalance,
    now: Date,
  ): Date {
    const lastSyncedAt =
      prevSyncState.balances?.[String(balance.id)]?.lastSyncedAt;

    if (lastSyncedAt) {
      return new Date(lastSyncedAt);
    }
    if (prevSyncState.syncStartDate) {
      return new Date(prevSyncState.syncStartDate);
    }
    const initial = new Date(now);
    initial.setDate(initial.getDate() - INITIAL_SYNC_WINDOW_DAYS);

    return initial;
  }

  private minDate(a: Date, b: Date): Date {
    return a < b ? a : b;
  }
}
