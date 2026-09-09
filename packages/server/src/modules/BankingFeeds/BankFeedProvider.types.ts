import { Knex } from 'knex';

export enum BankFeedProvider {
  Plaid = 'plaid',
  Wise = 'wise',
}

export interface BankFeedConnectContext {
  tenantId: number;
  userId: number;
  organizationId: string;
}

export interface BankFeedItemRecord {
  id?: number;
  tenantId: number;
  provider: BankFeedProvider | string;
  providerItemId: string;
  providerInstitutionId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  lastCursor?: string | null;
  syncState?: Record<string, any> | null;
  status?: string | null;
  pausedAt?: Date | null;
}

export interface BankFeedAccount {
  providerAccountId: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  currencyCode: string;
  accountType: string;
  currentBalance?: number | null;
}

export interface BankFeedTransaction {
  provider: BankFeedProvider | string;
  providerTransactionId: string;
  providerAccountId: string;
  date: string | Date;
  amount: number;
  currencyCode: string;
  description?: string;
  payee?: string | null;
  referenceNo?: string | null;
  pending?: boolean;
  pendingProviderTransactionId?: string | null;
}

export interface BankFeedTransactionUpdates {
  added: BankFeedTransaction[];
  modified: BankFeedTransaction[];
  removedProviderTransactionIds: string[];
  nextCursor?: string | null;
  syncState?: Record<string, any> | null;
  accessToken?: string | null;
}

export interface BankFeedWebhookEvent {
  providerItemId: string;
  type: 'transactions' | 'item' | 'unknown';
  code: string;
}

export interface IBankFeedTransactionsSyncedEventPayload {
  provider: BankFeedProvider | string;
  providerAccountId: string;
  accountId: number;
  batch: string;
  trx?: Knex.Transaction;
}

export interface BankFeedProviderClient {
  readonly provider: BankFeedProvider;

  createConnectLink?(ctx: BankFeedConnectContext): Promise<any>;
  exchangeConnectToken?(
    dto: any,
    ctx: BankFeedConnectContext,
  ): Promise<{
    providerItemId: string;
    providerInstitutionId?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
  }>;
  fetchAccounts(item: BankFeedItemRecord): Promise<{
    institutionName?: string | null;
    accounts: BankFeedAccount[];
  }>;
  fetchTransactionUpdates(
    item: BankFeedItemRecord,
  ): Promise<BankFeedTransactionUpdates>;
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<void>;
  mapWebhook(body: any): BankFeedWebhookEvent;
  removeItem?(item: BankFeedItemRecord): Promise<void>;
}
