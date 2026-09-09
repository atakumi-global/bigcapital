import { UseCls } from 'nestjs-cls';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Scope } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  UpdateBankingWiseTransactionsQueueJob,
  WiseFetchTransactionsEventPayload,
} from '../types/BankingWise.types';
import { WiseUpdateTransactions } from '../command/WiseUpdateTransactions';
import { SetupBankFeedItemTenantService } from '../../BankingFeeds/SetupBankFeedItemTenant.service';
import { BankFeedProvider } from '../../BankingFeeds/BankFeedProvider.types';
import { SocketGateway } from '../../Socket/Socket.gateway';

@Processor({
  name: UpdateBankingWiseTransactionsQueueJob,
  scope: Scope.REQUEST,
})
export class WiseFetchTransactionsProcessor extends WorkerHost {
  constructor(
    private readonly wiseUpdateTransactions: WiseUpdateTransactions,
    private readonly setupBankFeedItemTenant: SetupBankFeedItemTenantService,
    private readonly socketGateway: SocketGateway,
  ) {
    super();
  }

  /**
   * Triggers the function.
   */
  @UseCls()
  async process(job: Job<WiseFetchTransactionsEventPayload>) {
    const { providerItemId } = job.data;

    try {
      await this.setupBankFeedItemTenant.setupTenant(
        BankFeedProvider.Wise,
        providerItemId,
        () => this.wiseUpdateTransactions.sync(providerItemId),
      );
      // Notify the frontend to reflect the new transactions changes.
      this.socketGateway.emitNewTransactionsData();
    } catch (error) {
      console.log(error);
    }
  }
}
