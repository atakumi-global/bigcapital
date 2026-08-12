import { BaseModel } from '@/models/Model';

export class SystemBankFeedItem extends BaseModel {
  tenantId: number;
  provider: string;
  providerItemId: string;

  static get tableName() {
    return 'bank_feed_items';
  }

  get timestamps() {
    return [];
  }
}
