import { Test } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { WiseClient } from './Wise.client';
import { WISE_CLIENT } from './Wise.constants';
import {
  WiseAuthError,
  WiseRateLimitError,
  WiseTransientError,
} from './Wise.errors';

const buildAxiosError = (
  status: number,
  data: any = {},
  headers: Record<string, string> = {},
) => {
  return new AxiosError(
    `Request failed with status code ${status}`,
    undefined,
    undefined,
    undefined,
    {
      status,
      statusText: '',
      headers,
      data,
      config: {} as any,
    },
  );
};

describe('WiseClient', () => {
  const fakeHttp = { get: jest.fn() };

  const buildClient = async () => {
    // `overrideProvider` with a hand-rolled fake: no HTTP mocking library,
    // the fake axios instance is injected through the WISE_CLIENT token.
    const module = await Test.createTestingModule({
      providers: [WiseClient, { provide: WISE_CLIENT, useValue: {} }],
    })
      .overrideProvider(WISE_CLIENT)
      .useValue(fakeHttp)
      .compile();

    return module.get(WiseClient);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the response data on success', async () => {
    fakeHttp.get.mockResolvedValue({ data: [{ id: 1 }] });
    const client = await buildClient();

    await expect(client.listProfiles()).resolves.toEqual([{ id: 1 }]);
    expect(fakeHttp.get).toHaveBeenCalledWith('/profiles');
  });

  it('requests the balance statement with the COMPACT type and window', async () => {
    fakeHttp.get.mockResolvedValue({ data: { transactions: [] } });
    const client = await buildClient();

    await client.getBalanceStatement(12345, 64, {
      currency: 'EUR',
      intervalStart: '2026-08-01T00:00:00.000Z',
      intervalEnd: '2026-09-01T00:00:00.000Z',
    });
    expect(fakeHttp.get).toHaveBeenCalledWith(
      '/profiles/12345/balance-statements/64/statement.json',
      {
        params: {
          currency: 'EUR',
          intervalStart: '2026-08-01T00:00:00.000Z',
          intervalEnd: '2026-09-01T00:00:00.000Z',
          type: 'COMPACT',
        },
      },
    );
  });

  it.each([401, 403])('maps %i responses to WiseAuthError', async (status) => {
    fakeHttp.get.mockRejectedValue(
      buildAxiosError(status, { message: 'unauthorized' }),
    );
    const client = await buildClient();

    await expect(client.listBalances(1)).rejects.toBeInstanceOf(WiseAuthError);
  });

  it('maps 429 responses to WiseRateLimitError with the Retry-After window', async () => {
    fakeHttp.get.mockRejectedValue(
      buildAxiosError(429, {}, { 'retry-after': '30' }),
    );
    const client = await buildClient();

    const error = await client.listBalances(1).catch((err) => err);

    expect(error).toBeInstanceOf(WiseRateLimitError);
    expect((error as WiseRateLimitError).retryAfterSeconds).toBe(30);
  });

  it.each([500, 502, 503])(
    'maps %i responses to WiseTransientError',
    async (status) => {
      fakeHttp.get.mockRejectedValue(buildAxiosError(status));
      const client = await buildClient();

      await expect(client.listBalances(1)).rejects.toBeInstanceOf(
        WiseTransientError,
      );
    },
  );

  it('passes through non-HTTP errors untouched', async () => {
    const networkError = new Error('socket hang up');
    fakeHttp.get.mockRejectedValue(networkError);
    const client = await buildClient();

    await expect(client.listBalances(1)).rejects.toBe(networkError);
  });
});
