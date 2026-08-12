import { Inject, Injectable } from '@nestjs/common';
import { PlaidItem } from '../models/PlaidItem';
import { PlaidApi } from 'plaid';
import { PLAID_CLIENT } from '../../Plaid/Plaid.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { SystemPlaidItem } from '../models/SystemPlaidItem';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { IPlaidItemCreatedEventPayload } from '../types/BankingPlaid.types';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { PlaidItemDto } from '../dtos/PlaidItem.dto';
import { BankFeedItem } from '../../BankingFeeds/models/BankFeedItem';
import { SystemBankFeedItem } from '../../BankingFeeds/models/SystemBankFeedItem';
import { BankFeedProvider } from '../../BankingFeeds/BankFeedProvider.types';

@Injectable()
export class PlaidItemService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyContext: TenancyContext,

    @Inject(SystemPlaidItem.name)
    private readonly systemPlaidItemModel: typeof SystemPlaidItem,

    @Inject(PlaidItem.name)
    private readonly plaidItemModel: TenantModelProxy<typeof PlaidItem>,

    @Inject(BankFeedItem.name)
    private readonly bankFeedItemModel: TenantModelProxy<typeof BankFeedItem>,

    @Inject(SystemBankFeedItem.name)
    private readonly systemBankFeedItemModel: typeof SystemBankFeedItem,

    @Inject(PLAID_CLIENT)
    private readonly plaidClient: PlaidApi,
  ) {}

  /**
   * Exchanges the public token to get access token and item id and then creates
   * a new Plaid item.
   * @param {PlaidItemDto} itemDTO - Plaid item data transfer object.
   * @returns {Promise<void>}
   */
  public async item(itemDTO: PlaidItemDto): Promise<void> {
    const { publicToken, institutionId } = itemDTO;

    const tenant = await this.tenancyContext.getTenant();
    const tenantId = tenant.id;

    // Exchange the public token for a private access token and store with the item.
    const response = await this.plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const plaidAccessToken = response.data.access_token;
    const plaidItemId = response.data.item_id;

    // Store the Plaid item metadata on tenant scope (legacy Plaid table).
    await this.plaidItemModel().query().insert({
      tenantId,
      plaidAccessToken,
      plaidItemId,
      plaidInstitutionId: institutionId,
    });
    // Store the provider-neutral item metadata on tenant scope.
    await this.bankFeedItemModel().query().insert({
      tenantId,
      provider: BankFeedProvider.Plaid,
      providerItemId: plaidItemId,
      providerInstitutionId: institutionId,
      accessToken: plaidAccessToken,
    });

    // Stores the Plaid item id on system scope (legacy Plaid table).
    await this.systemPlaidItemModel.query().insert({ tenantId, plaidItemId });
    // Stores the provider-neutral item id on system scope for webhook tenant resolution.
    await this.systemBankFeedItemModel.query().insert({
      tenantId,
      provider: BankFeedProvider.Plaid,
      providerItemId: plaidItemId,
    });

    // Triggers `onPlaidItemCreated` event.
    await this.eventEmitter.emitAsync(events.plaid.onItemCreated, {
      plaidAccessToken,
      plaidItemId,
      plaidInstitutionId: institutionId,
    } as IPlaidItemCreatedEventPayload);
  }
}
