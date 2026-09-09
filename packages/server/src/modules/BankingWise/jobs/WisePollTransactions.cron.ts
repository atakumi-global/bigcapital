import * as bluebird from 'bluebird';
import { Cron } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { SystemBankFeedItem } from '../../BankingFeeds/models/SystemBankFeedItem';
import { BankFeedProvider } from '../../BankingFeeds/BankFeedProvider.types';
import { WiseSyncEnqueueService } from '../WiseSyncEnqueue.service';

@Injectable()
export class WisePollTransactionsCron {
  constructor(
    @Inject(SystemBankFeedItem.name)
    private readonly systemBankFeedItemModel: typeof SystemBankFeedItem,
    private readonly wiseSyncEnqueueService: WiseSyncEnqueueService,
  ) {}

  /**
   * Enqueues a sync job for every connected Wise item every 6 hours. Tenant
   * CLS is established by the queue processor per item; the cron itself only
   * touches the system DB.
   */
  @Cron('0 */6 * * *')
  async pollWiseTransactions() {
    try {
      const items = await this.systemBankFeedItemModel
        .query()
        .where({ provider: BankFeedProvider.Wise });

      await bluebird.map(
        items,
        (item) => this.wiseSyncEnqueueService.enqueue(item.providerItemId),
        { concurrency: 5 },
      );
    } catch (error) {
      console.log(error);
    }
  }
}
