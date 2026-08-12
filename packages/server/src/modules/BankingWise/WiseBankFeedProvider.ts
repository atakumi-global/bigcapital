import {
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankFeedAccount,
  BankFeedConnectContext,
  BankFeedItemRecord,
  BankFeedProvider,
  BankFeedProviderClient,
  BankFeedTransactionUpdates,
  BankFeedWebhookEvent,
} from '../BankingFeeds/BankFeedProvider.types';

@Injectable()
export class WiseBankFeedProvider implements BankFeedProviderClient {
  readonly provider = BankFeedProvider.Wise;

  constructor(private readonly configService: ConfigService) {}

  private assertConfigured(): void {
    if (!this.configService.get('wise.apiToken')) {
      throw new InternalServerErrorException(
        'Wise bank feed is not configured. Set WISE_API_TOKEN, WISE_API_BASE_URL, and WISE_PROFILE_ID.',
      );
    }
  }

  createConnectLink(_ctx: BankFeedConnectContext): Promise<any> {
    this.assertConfigured();
    // TODO: Confirm the Wise connect product (OAuth/link flow), required scopes,
    // and the exact connect-url contract before wiring this to the webapp.
    throw new NotImplementedException(
      'Wise connect link flow is not implemented yet.',
    );
  }

  exchangeConnectToken(
    _dto: any,
    _ctx: BankFeedConnectContext,
  ): Promise<{
    providerItemId: string;
    providerInstitutionId?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
  }> {
    this.assertConfigured();
    // TODO: Exchange the Wise public/OAuth code and persist tokens on bank_feed_items.
    throw new NotImplementedException(
      'Wise connect token exchange is not implemented yet.',
    );
  }

  fetchAccounts(_item: BankFeedItemRecord): Promise<{
    institutionName?: string | null;
    accounts: BankFeedAccount[];
  }> {
    this.assertConfigured();
    // TODO: Map Wise profile/borderless accounts to BankFeedAccount[] and normalize
    // account type/currency/balance/mask before calling BankFeedSyncDb.syncBankAccounts().
    throw new NotImplementedException(
      'Wise account fetching is not implemented yet.',
    );
  }

  fetchTransactionUpdates(
    _item: BankFeedItemRecord,
  ): Promise<BankFeedTransactionUpdates> {
    this.assertConfigured();
    // TODO: Choose the Wise sync strategy (statement polling window vs webhook-driven
    // fetch) and map Wise transactions to the normalized BankFeedTransaction shape.
    throw new NotImplementedException(
      'Wise transaction fetching is not implemented yet.',
    );
  }

  verifyWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string>,
  ): Promise<void> {
    this.assertConfigured();
    // TODO: Implement Wise webhook signature verification once the exact Wise
    // signature header/algorithm for the selected product is confirmed.
    throw new NotImplementedException(
      'Wise webhook verification is not implemented yet.',
    );
  }

  mapWebhook(_body: any): BankFeedWebhookEvent {
    // Keep this synchronous and side-effect free so the webhook controller can
    // route unknown/unsupported payloads without touching Wise credentials.
    throw new NotImplementedException(
      'Wise webhook payload mapping is not implemented yet.',
    );
  }
}
