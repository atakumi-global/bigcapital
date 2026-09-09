import { ClsService } from 'nestjs-cls';
import { Inject, Injectable } from '@nestjs/common';
import { SystemBankFeedItem } from './models/SystemBankFeedItem';
import { TenantModel } from '@/modules/System/models/TenantModel';
import { SystemUser } from '@/modules/System/models/SystemUser';
import { BankFeedProvider } from './BankFeedProvider.types';

@Injectable()
export class SetupBankFeedItemTenantService {
  constructor(
    private readonly clsService: ClsService,

    @Inject(SystemBankFeedItem.name)
    private readonly systemBankFeedItemModel: typeof SystemBankFeedItem,

    @Inject(TenantModel.name)
    private readonly tenantModel: typeof TenantModel,

    @Inject(SystemUser.name)
    private readonly systemUserModel: typeof SystemUser,
  ) {}

  /**
   * Resolves the tenant of the given provider item and establishes its CLS
   * context (organization id + first active user) before running the callback.
   * Used by queue processors and cron jobs that run outside tenant CLS.
   * @param {BankFeedProvider | string} provider - Bank feed provider.
   * @param {string} providerItemId - Provider item id.
   * @param {() => Promise<any>} callback - Work to run in the tenant context.
   * @returns {Promise<any>}
   */
  public async setupTenant(
    provider: BankFeedProvider | string,
    providerItemId: string,
    callback: () => Promise<any>,
  ) {
    const bankFeedItem = await this.systemBankFeedItemModel.query().findOne({
      provider,
      providerItemId,
    });
    if (!bankFeedItem) {
      throw new Error(
        `Bank feed item not found (provider: ${provider}, item: ${providerItemId}).`,
      );
    }
    const tenant = await this.tenantModel
      .query()
      .findOne({ id: bankFeedItem.tenantId })
      .throwIfNotFound();

    const user = await this.systemUserModel
      .query()
      .findOne({ tenantId: tenant.id })
      .modify('active')
      .throwIfNotFound();

    this.clsService.set('organizationId', tenant.organizationId);
    this.clsService.set('userId', user.id);

    return callback();
  }
}
