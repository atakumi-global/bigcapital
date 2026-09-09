import { BaseModel } from '@/models/Model';

export class BankFeedItem extends BaseModel {
  tenantId: number;
  provider: string;
  providerItemId: string;
  providerInstitutionId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  lastCursor?: string | null;
  syncState?: Record<string, any> | null;
  status?: string | null;
  pausedAt?: Date | null;

  static get tableName() {
    return 'bank_feed_items';
  }

  get timestamps() {
    return [];
  }

  static get jsonAttributes() {
    return ['syncState'];
  }

  static get virtualAttributes() {
    return ['isPaused'];
  }

  get isPaused() {
    return !!this.pausedAt;
  }
}
