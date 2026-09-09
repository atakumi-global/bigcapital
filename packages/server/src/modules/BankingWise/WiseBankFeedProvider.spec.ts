import * as fs from 'fs';
import * as path from 'path';
import { WiseBankFeedProvider } from './WiseBankFeedProvider';
import { WiseBalance } from '../Wise/Wise.types';

const loadFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../../test/fixtures/wise', name),
      'utf-8',
    ),
  );

const balancesFixture = loadFixture('balances.json') as WiseBalance[];
const statementEurFixture = loadFixture('statement-eur.json');

const PROFILE_ID = '12345';

describe('WiseBankFeedProvider', () => {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'wise.apiToken' ? 'read-only-token' : undefined,
    ),
  };
  const wiseClient = {
    listBalances: jest.fn(),
    getBalanceStatement: jest.fn(),
  };

  const buildProvider = () =>
    new WiseBankFeedProvider(configService as any, wiseClient as any);

  beforeEach(() => {
    jest.clearAllMocks();

    wiseClient.listBalances.mockResolvedValue(balancesFixture);
    wiseClient.getBalanceStatement.mockResolvedValue(statementEurFixture);
  });

  it('maps the syncable balances to bank feed accounts', async () => {
    const provider = buildProvider();
    const { institutionName, accounts } = await provider.fetchAccounts({
      tenantId: 1,
      provider: 'wise',
      providerItemId: PROFILE_ID,
    });

    expect(institutionName).toBe('Wise');
    expect(accounts).toHaveLength(3);
    expect(accounts[0]).toMatchObject({
      providerAccountId: '64',
      name: 'Wise — EUR',
      currencyCode: 'EUR',
      currentBalance: 1520.42,
    });
    expect(accounts[2]).toMatchObject({
      providerAccountId: '66',
      name: 'Wise — Rainy day jar (NZD)',
      currencyCode: 'NZD',
    });
  });

  it('fetches statements per balance and returns the added transactions', async () => {
    const provider = buildProvider();
    const updates = await provider.fetchTransactionUpdates({
      tenantId: 1,
      provider: 'wise',
      providerItemId: PROFILE_ID,
      syncState: null,
    });

    // One statement request per syncable balance.
    expect(wiseClient.getBalanceStatement).toHaveBeenCalledTimes(3);
    // Wise statements are append-only: no modified/removed.
    expect(updates.modified).toEqual([]);
    expect(updates.removedProviderTransactionIds).toEqual([]);
    // 3 balances x 3 fixture transactions.
    expect(updates.added).toHaveLength(9);
    expect(updates.added[0]).toMatchObject({
      provider: 'wise',
      providerAccountId: '64',
      providerTransactionId: 'CARD-REF-0001',
      amount: -25.5,
    });
    // The sync state cursor advances for every balance.
    expect(updates.syncState?.profileId).toBe(12345);
    expect(Object.keys(updates.syncState?.balances || {})).toEqual([
      '64',
      '65',
      '66',
    ]);
  });

  it('uses the persisted per-balance cursor as the window start', async () => {
    const lastSyncedAt = '2026-08-15T00:00:00.000Z';
    const provider = buildProvider();

    await provider.fetchTransactionUpdates({
      tenantId: 1,
      provider: 'wise',
      providerItemId: PROFILE_ID,
      syncState: {
        profileId: 12345,
        balances: { '64': { currency: 'EUR', lastSyncedAt } },
      },
    });

    const eurCall = wiseClient.getBalanceStatement.mock.calls.find(
      (call) => call[1] === 64,
    );
    expect(eurCall?.[2].intervalStart).toBe(lastSyncedAt);
    expect(eurCall?.[2].currency).toBe('EUR');
  });

  it('starts new balances with a ~90 days window', async () => {
    const provider = buildProvider();
    const before = Date.now();

    await provider.fetchTransactionUpdates({
      tenantId: 1,
      provider: 'wise',
      providerItemId: PROFILE_ID,
      syncState: null,
    });

    const [, , params] = wiseClient.getBalanceStatement.mock.calls[0];
    const intervalStart = new Date(params.intervalStart).getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    expect(intervalStart).toBeGreaterThan(before - ninetyDays - 60_000);
    expect(intervalStart).toBeLessThanOrEqual(before - ninetyDays + 60_000);
  });

  it('preserves the cursors of balances that are no longer syncable', async () => {
    const provider = buildProvider();

    const updates = await provider.fetchTransactionUpdates({
      tenantId: 1,
      provider: 'wise',
      providerItemId: PROFILE_ID,
      syncState: {
        profileId: 12345,
        balances: {
          '99': { currency: 'JPY', lastSyncedAt: '2026-01-01T00:00:00.000Z' },
        },
      },
    });

    expect(updates.syncState?.balances?.['99']).toEqual({
      currency: 'JPY',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
