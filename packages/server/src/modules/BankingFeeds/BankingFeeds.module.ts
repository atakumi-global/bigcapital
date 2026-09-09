import { Module } from '@nestjs/common';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { InjectSystemModel } from '../System/SystemModels/SystemModels.module';
import { AccountsModule } from '../Accounts/Accounts.module';
import { BankingCategorizeModule } from '../BankingCategorize/BankingCategorize.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { BankFeedItem } from './models/BankFeedItem';
import { SystemBankFeedItem } from './models/SystemBankFeedItem';
import { BankFeedSyncDb } from './BankFeedSyncDb';
import { SetupBankFeedItemTenantService } from './SetupBankFeedItemTenant.service';

const tenantModels = [RegisterTenancyModel(BankFeedItem)];
const systemModels = [InjectSystemModel(SystemBankFeedItem)];

@Module({
  imports: [
    AccountsModule,
    BankingCategorizeModule,
    BankingTransactionsModule,
    ...tenantModels,
  ],
  providers: [...systemModels, BankFeedSyncDb, SetupBankFeedItemTenantService],
  exports: [
    ...tenantModels,
    SystemBankFeedItem.name,
    BankFeedSyncDb,
    SetupBankFeedItemTenantService,
  ],
})
export class BankingFeedsModule {}
