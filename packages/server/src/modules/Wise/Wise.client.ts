import { AxiosInstance, AxiosError } from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { WISE_CLIENT } from './Wise.constants';
import {
  GetWiseBalanceStatementParams,
  WiseBalance,
  WiseBalanceStatement,
  WiseProfile,
} from './Wise.types';
import {
  WiseAuthError,
  WiseRateLimitError,
  WiseTransientError,
} from './Wise.errors';

@Injectable()
export class WiseClient {
  constructor(
    @Inject(WISE_CLIENT)
    private readonly http: AxiosInstance,
  ) {}

  /**
   * Lists the profiles visible to the configured API token.
   * @returns {Promise<WiseProfile[]>}
   */
  public listProfiles(): Promise<WiseProfile[]> {
    return this.request((http) => http.get('/profiles'));
  }

  /**
   * Retrieves a single profile by id.
   * @param {number} profileId - Wise profile id.
   * @returns {Promise<WiseProfile>}
   */
  public getProfile(profileId: number | string): Promise<WiseProfile> {
    return this.request((http) => http.get(`/profiles/${profileId}`));
  }

  /**
   * Lists the balance accounts of the given profile. The endpoint requires
   * the `types` filter; standard balances and savings jars support statements.
   * @param {number} profileId - Wise profile id.
   * @returns {Promise<WiseBalance[]>}
   */
  public listBalances(profileId: number | string): Promise<WiseBalance[]> {
    return this.request((http) =>
      http.get(`/profiles/${profileId}/balances`, {
        params: { types: 'STANDARD,SAVINGS' },
      }),
    );
  }

  /**
   * Retrieves the balance statement (transactions) of the given balance.
   * @param {number} profileId - Wise profile id.
   * @param {number} balanceId - Wise balance id.
   * @param {GetWiseBalanceStatementParams} params - Statement window.
   * @returns {Promise<WiseBalanceStatement>}
   */
  public getBalanceStatement(
    profileId: number | string,
    balanceId: number | string,
    params: GetWiseBalanceStatementParams,
  ): Promise<WiseBalanceStatement> {
    return this.request((http) =>
      http.get(
        `/profiles/${profileId}/balance-statements/${balanceId}/statement.json`,
        {
          params: {
            currency: params.currency,
            intervalStart: params.intervalStart,
            intervalEnd: params.intervalEnd,
            type: 'COMPACT',
          },
        },
      ),
    );
  }

  /**
   * Performs the request and maps HTTP failures to typed Wise errors.
   */
  private async request<T>(
    fn: (http: AxiosInstance) => Promise<{ data: T }>,
  ): Promise<T> {
    try {
      const response = await fn(this.http);
      return response.data;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  /**
   * Maps axios errors to typed Wise errors.
   */
  private mapError(error: any): Error {
    if (!(error instanceof AxiosError) || !error.response) {
      return error instanceof Error ? error : new Error(String(error));
    }
    const { status, headers, data } = error.response;
    const detail =
      (data as any)?.message || (data as any)?.error || error.message;

    if (status === 401 || status === 403) {
      return new WiseAuthError(`Wise API ${status}: ${detail}`);
    }
    if (status === 429) {
      const retryAfter = Number(headers?.['retry-after']);
      return new WiseRateLimitError(
        `Wise API 429: ${detail}`,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    if (status >= 500) {
      return new WiseTransientError(`Wise API ${status}: ${detail}`);
    }
    return error;
  }
}
