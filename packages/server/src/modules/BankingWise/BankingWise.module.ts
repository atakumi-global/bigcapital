import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SocketModule } from '../Socket/Socket.module';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { WiseModule } from '../Wise/Wise.module';
import { BankingFeedsModule } from '../BankingFeeds/BankingFeeds.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { AccountsModule } from '../Accounts/Accounts.module';
import { WiseBankFeedProvider } from './WiseBankFeedProvider';
import { WiseItemService } from './WiseItem.service';
import { WiseSyncEnqueueService } from './WiseSyncEnqueue.service';
import { WiseUpdateTransactions } from './command/WiseUpdateTransactions';
import { WiseFetchTransactionsProcessor } from './jobs/WiseFetchTransactionsJob';
import { WisePollTransactionsCron } from './jobs/WisePollTransactions.cron';
import { WiseSyncOnItemCreatedSubscriber } from './subscribers/WiseSyncOnItemCreated.subscriber';
import { BankingWiseController } from './BankingWise.controller';
import { UpdateBankingWiseTransactionsQueueJob } from './types/BankingWise.types';

@Module({
  imports: [
    TenancyModule,
    SocketModule,
    WiseModule,
    BankingFeedsModule,
    BankingTransactionsModule,
    AccountsModule,
    BullModule.registerQueue({
      name: UpdateBankingWiseTransactionsQueueJob,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    BullBoardModule.forFeature({
      name: UpdateBankingWiseTransactionsQueueJob,
      adapter: BullMQAdapter,
    }),
  ],
  providers: [
    WiseBankFeedProvider,
    WiseItemService,
    WiseSyncEnqueueService,
    WiseUpdateTransactions,
    WiseFetchTransactionsProcessor,
    WisePollTransactionsCron,
    WiseSyncOnItemCreatedSubscriber,
  ],
  exports: [WiseBankFeedProvider],
  controllers: [BankingWiseController],
})
export class BankingWiseModule {}
