import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  UpdateBankingWiseTransactionsJob,
  UpdateBankingWiseTransactionsQueueJob,
  WiseFetchTransactionsEventPayload,
} from './types/BankingWise.types';

@Injectable()
export class WiseSyncEnqueueService {
  constructor(
    @InjectQueue(UpdateBankingWiseTransactionsQueueJob)
    private readonly updateTransactionsQueue: Queue,
  ) {}

  /**
   * Enqueues a Wise transactions sync job. The deterministic `jobId`
   * coalesces manual, cron and (future) webhook triggers of the same item.
   * @param {string} providerItemId - Wise profile id.
   * @returns {Promise<void>}
   */
  public async enqueue(providerItemId: string): Promise<void> {
    const payload: WiseFetchTransactionsEventPayload = { providerItemId };

    await this.updateTransactionsQueue.add(
      UpdateBankingWiseTransactionsJob,
      payload,
      { jobId: `wise:${providerItemId}` },
    );
  }
}
