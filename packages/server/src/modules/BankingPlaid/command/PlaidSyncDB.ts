import { Injectable } from '@nestjs/common';
import { BankFeedSyncDb } from '../../BankingFeeds/BankFeedSyncDb';

/**
 * @deprecated Use BankFeedSyncDb. Kept as a compatibility alias while callers migrate.
 */
@Injectable()
export class PlaidSyncDb extends BankFeedSyncDb {}
