import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { BankFeedProvider } from '../../BankingFeeds/BankFeedProvider.types';
import { WiseSyncEnqueueService } from '../WiseSyncEnqueue.service';
import { IBankFeedItemCreatedEventPayload } from '../types/BankingWise.types';

@Injectable()
export class WiseSyncOnItemCreatedSubscriber {
  constructor(
    private readonly wiseSyncEnqueueService: WiseSyncEnqueueService,
  ) {}

  /**
   * Enqueues the initial transactions sync when a Wise item is created.
   * @param {IBankFeedItemCreatedEventPayload} payload - Event payload.
   */
  @OnEvent(events.bankFeed.onItemCreated)
  public async handleBankFeedItemCreated({
    provider,
    providerItemId,
  }: IBankFeedItemCreatedEventPayload) {
    if (provider !== BankFeedProvider.Wise) {
      return;
    }
    await this.wiseSyncEnqueueService.enqueue(providerItemId);
  }
}
