import { WiseBalance, WiseProfile } from '../../Wise/Wise.types';

export const UpdateBankingWiseTransactionsJob =
  'update-banking-wise-transactions-job';

export const UpdateBankingWiseTransactionsQueueJob =
  'update-banking-wise-transactions-queue';

export interface WiseFetchTransactionsEventPayload {
  providerItemId: string;
}

export interface IBankFeedItemCreatedEventPayload {
  provider: string;
  providerItemId: string;
  tenantId: number;
}

export interface WiseStatusResponse {
  configured: boolean;
  connected: boolean;
  profileId: string | null;
  profile: WiseProfile | null;
  balances: WiseBalance[];
  lastSyncedAt: string | null;
  syncStartDate: string | null;
  paused: boolean;
  status: string | null;
}
