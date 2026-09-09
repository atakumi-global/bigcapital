import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { Account } from '../Accounts/models/Account.model';
import { BankFeedItem } from '../BankingFeeds/models/BankFeedItem';
import { SystemBankFeedItem } from '../BankingFeeds/models/SystemBankFeedItem';
import { BankFeedProvider } from '../BankingFeeds/BankFeedProvider.types';
import { WiseClient } from '../Wise/Wise.client';
import { WiseBalance, WiseProfile } from '../Wise/Wise.types';
import { isSyncableWiseBalance } from './BankingWise.utils';
import { ConnectWiseDto } from './dtos/ConnectWise.dto';
import {
  IBankFeedItemCreatedEventPayload,
  WiseStatusResponse,
} from './types/BankingWise.types';
import { WiseItemSyncState } from './WiseBankFeedProvider';

@Injectable()
export class WiseItemService {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyContext: TenancyContext,
    private readonly wiseClient: WiseClient,

    @Inject(BankFeedItem.name)
    private readonly bankFeedItemModel: TenantModelProxy<typeof BankFeedItem>,

    @Inject(SystemBankFeedItem.name)
    private readonly systemBankFeedItemModel: typeof SystemBankFeedItem,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * Retrieves the Wise integration status of the current tenant. Drives all
   * the webapp UI states (not-configured, not-connected, connected, error).
   * @returns {Promise<WiseStatusResponse>}
   */
  public async getStatus(): Promise<WiseStatusResponse> {
    const configured = this.isConfigured();
    const item = await this.getTenantWiseItem();

    let profileId: string | null = item?.providerItemId ?? null;
    let profile: WiseProfile | null = null;
    let balances: WiseBalance[] = [];
    let status: string | null = item?.status ?? null;

    if (configured) {
      try {
        profileId = profileId ?? (await this.resolveProfileId());
        if (profileId) {
          [profile, balances] = await Promise.all([
            this.wiseClient.getProfile(profileId),
            this.wiseClient.listBalances(profileId),
          ]);
          balances = balances.filter(isSyncableWiseBalance);
        }
      } catch (_error) {
        // Surface Wise API failures as an error status instead of a 500 so the
        // UI can still render the not-configured/error state.
        status = 'error';
      }
    }
    return {
      configured,
      connected: !!item,
      profileId,
      profile,
      balances,
      lastSyncedAt: this.getLastSyncedAt(item),
      paused: item?.isPaused ?? false,
      status,
    };
  }

  /**
   * Lists the Wise profiles visible to the configured API token. Used by the
   * profile picker when `WISE_PROFILE_ID` is unset.
   * @returns {Promise<WiseProfile[]>}
   */
  public async getProfiles(): Promise<WiseProfile[]> {
    this.assertConfigured();

    return this.wiseClient.listProfiles();
  }

  /**
   * Connects the current tenant to a Wise profile: stores the provider item
   * on both tenant and system scope and triggers the initial sync.
   * @param {ConnectWiseDto} connectDTO - Optional profile id.
   * @returns {Promise<{ profileId: string }>}
   */
  public async connect(
    connectDTO?: ConnectWiseDto,
  ): Promise<{ profileId: string }> {
    this.assertConfigured();

    const profileId =
      connectDTO?.profileId != null
        ? String(connectDTO.profileId)
        : await this.resolveProfileId();

    if (!profileId) {
      throw new BadRequestException(
        'Cannot resolve a Wise profile. Set WISE_PROFILE_ID or pass profileId.',
      );
    }
    // Validates the token can actually access the profile before persisting.
    await this.wiseClient.getProfile(profileId);

    const tenant = await this.tenancyContext.getTenant();
    const tenantId = tenant.id;

    try {
      // Store the provider item on tenant scope. Credentials stay in env, the
      // `accessToken` column stays `null` by design.
      await this.bankFeedItemModel().query().insert({
        tenantId,
        provider: BankFeedProvider.Wise,
        providerItemId: profileId,
        accessToken: null,
        status: 'active',
      });
      // Store the item on system scope for job/webhook tenant resolution.
      // `UNIQUE(provider, provider_item_id)` guarantees one tenant per profile.
      await this.systemBankFeedItemModel.query().insert({
        tenantId,
        provider: BankFeedProvider.Wise,
        providerItemId: profileId,
      });
    } catch (error) {
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException('This Wise profile is already connected.');
      }
      throw error;
    }
    // Triggers `onBankFeedItemCreated` event.
    await this.eventEmitter.emitAsync(events.bankFeed.onItemCreated, {
      provider: BankFeedProvider.Wise,
      providerItemId: profileId,
      tenantId,
    } as IBankFeedItemCreatedEventPayload);

    return { profileId };
  }

  /**
   * Pauses the Wise feed sync of the current tenant.
   * @returns {Promise<void>}
   */
  public async pause(): Promise<void> {
    const item = await this.getTenantWiseItemOrThrow();

    await this.bankFeedItemModel()
      .query()
      .findById(item.id)
      .patch({ pausedAt: new Date() });
  }

  /**
   * Resumes the Wise feed sync of the current tenant.
   * @returns {Promise<void>}
   */
  public async resume(): Promise<void> {
    const item = await this.getTenantWiseItemOrThrow();

    await this.bankFeedItemModel()
      .query()
      .findById(item.id)
      .patch({ pausedAt: null });
  }

  /**
   * Disconnects the Wise profile of the current tenant: removes the feed item
   * rows and clears the feed columns of the owned bank accounts.
   * @returns {Promise<void>}
   */
  public async disconnect(): Promise<void> {
    const item = await this.getTenantWiseItemOrThrow();
    const providerItemId = item.providerItemId;

    await this.bankFeedItemModel().query().deleteById(item.id);
    await this.systemBankFeedItemModel
      .query()
      .where({ provider: BankFeedProvider.Wise, providerItemId })
      .delete();

    // Detach the owned accounts from the feed.
    await this.accountModel()
      .query()
      .where({
        bankFeedProvider: BankFeedProvider.Wise,
        bankFeedProviderItemId: providerItemId,
      })
      .patch({
        bankFeedProvider: null,
        bankFeedProviderItemId: null,
        bankFeedProviderAccountId: null,
        isFeedsActive: false,
        isSyncingOwner: false,
      });
  }

  /**
   * Retrieves the tenant Wise feed item, if any.
   * @returns {Promise<BankFeedItem | undefined>}
   */
  public async getTenantWiseItem(): Promise<BankFeedItem | undefined> {
    return this.bankFeedItemModel()
      .query()
      .findOne({ provider: BankFeedProvider.Wise });
  }

  /**
   * Retrieves the tenant Wise feed item or throws when not connected.
   * @returns {Promise<BankFeedItem>}
   */
  private async getTenantWiseItemOrThrow(): Promise<BankFeedItem> {
    const item = await this.getTenantWiseItem();

    if (!item) {
      throw new NotFoundException('Wise is not connected.');
    }
    return item;
  }

  /**
   * Resolves the Wise profile id: configured env value first, then the only
   * profile of the token. Returns `null` when ambiguous.
   * @returns {Promise<string | null>}
   */
  private async resolveProfileId(): Promise<string | null> {
    const configuredProfileId = this.configService.get('wise.profileId');

    if (configuredProfileId) {
      return String(configuredProfileId);
    }
    const profiles = await this.wiseClient.listProfiles();

    return profiles.length === 1 ? String(profiles[0].id) : null;
  }

  /**
   * Retrieves the latest per-balance sync cursor of the item sync state.
   * @param {BankFeedItem} item - Bank feed item.
   * @returns {string | null}
   */
  private getLastSyncedAt(item?: BankFeedItem): string | null {
    const syncState = item?.syncState as WiseItemSyncState | undefined;
    const cursors = Object.values(syncState?.balances || {}).map(
      (balance) => balance.lastSyncedAt,
    );
    return cursors.length
      ? cursors.reduce((latest, cursor) => (cursor > latest ? cursor : latest))
      : null;
  }

  private isConfigured(): boolean {
    return !!this.configService.get('wise.apiToken');
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Wise bank feed is not configured. Set WISE_API_TOKEN, WISE_API_BASE_URL, and WISE_PROFILE_ID.',
      );
    }
  }

  private isDuplicateEntryError(error: any): boolean {
    return error?.code === 'ER_DUP_ENTRY' && error?.errno === 1062;
  }
}
