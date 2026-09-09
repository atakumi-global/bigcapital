import { Knex } from 'knex';
import { BankFeedProvider } from '../../BankingFeeds/BankFeedProvider.types';
import { WiseAuthError } from '../../Wise/Wise.errors';
import { WiseUpdateTransactions } from './WiseUpdateTransactions';

const PROVIDER_ITEM_ID = '12345';

describe('WiseUpdateTransactions', () => {
  const trx = {} as Knex.Transaction;

  // Query chain builder mocks. Terminal methods resolve promises, mirroring
  // the Objection.js query builder interface used by the service.
  const feedItemQuery = {
    findOne: jest.fn(),
    forUpdate: jest.fn(),
    patch: jest.fn(),
  };
  const uncategorizedQuery = {
    where: jest.fn(),
    whereIn: jest.fn(),
    select: jest.fn(),
  };

  const bankFeedItemModel = jest.fn(() => ({
    query: jest.fn(() => feedItemQuery),
  }));
  const uncategorizedBankTransactionModel = jest.fn(() => ({
    query: jest.fn(() => uncategorizedQuery),
  }));

  const uow = {
    withTransaction: jest.fn((work: (trx: Knex.Transaction) => any) =>
      work(trx),
    ),
  };
  const wiseBankFeedProvider = {
    fetchAccounts: jest.fn(),
    fetchTransactionUpdates: jest.fn(),
  };
  const bankFeedSyncDb = {
    syncBankAccounts: jest.fn(),
    syncAccountsTransactions: jest.fn(),
    syncTransactionsCursor: jest.fn(),
    updateLastFeedsUpdatedAt: jest.fn(),
    updateAccountsFeedsActive: jest.fn(),
  };

  const buildService = () =>
    new WiseUpdateTransactions(
      uow as any,
      wiseBankFeedProvider as any,
      bankFeedSyncDb as any,
      bankFeedItemModel as any,
      uncategorizedBankTransactionModel as any,
    );

  const activeItem = {
    id: 1,
    provider: BankFeedProvider.Wise,
    providerItemId: PROVIDER_ITEM_ID,
    isPaused: false,
    syncState: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    feedItemQuery.findOne.mockReturnValue(feedItemQuery);
    feedItemQuery.patch.mockResolvedValue(1);
    uncategorizedQuery.where.mockReturnValue(uncategorizedQuery);
    uncategorizedQuery.whereIn.mockReturnValue(uncategorizedQuery);
    uncategorizedQuery.select.mockResolvedValue([]);

    wiseBankFeedProvider.fetchAccounts.mockResolvedValue({
      institutionName: 'Wise',
      accounts: [
        {
          providerAccountId: '64',
          name: 'Wise — EUR',
          currencyCode: 'EUR',
          accountType: 'bank',
          currentBalance: 1520.42,
        },
      ],
    });
    wiseBankFeedProvider.fetchTransactionUpdates.mockResolvedValue({
      added: [],
      modified: [],
      removedProviderTransactionIds: [],
      syncState: {
        profileId: 12345,
        balances: { '64': { currency: 'EUR', lastSyncedAt: 'now' } },
      },
    });
  });

  it('does nothing when the item is paused', async () => {
    feedItemQuery.forUpdate.mockResolvedValue({
      ...activeItem,
      isPaused: true,
    });
    await buildService().sync(PROVIDER_ITEM_ID);

    expect(wiseBankFeedProvider.fetchAccounts).not.toHaveBeenCalled();
    expect(bankFeedSyncDb.syncBankAccounts).not.toHaveBeenCalled();
  });

  it('does nothing when the item was disconnected', async () => {
    feedItemQuery.forUpdate.mockResolvedValue(undefined);
    await buildService().sync(PROVIDER_ITEM_ID);

    expect(wiseBankFeedProvider.fetchAccounts).not.toHaveBeenCalled();
  });

  it('syncs accounts, transactions, cursor and feed flags', async () => {
    feedItemQuery.forUpdate.mockResolvedValue(activeItem);
    await buildService().sync(PROVIDER_ITEM_ID);

    expect(bankFeedSyncDb.syncBankAccounts).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          bankFeedProvider: BankFeedProvider.Wise,
          bankFeedProviderItemId: PROVIDER_ITEM_ID,
          bankFeedProviderAccountId: '64',
        }),
      ],
      trx,
    );
    expect(bankFeedSyncDb.syncTransactionsCursor).toHaveBeenCalledWith(
      BankFeedProvider.Wise,
      PROVIDER_ITEM_ID,
      null,
      expect.objectContaining({ profileId: 12345 }),
      trx,
    );
    expect(bankFeedSyncDb.updateLastFeedsUpdatedAt).toHaveBeenCalledWith(
      BankFeedProvider.Wise,
      ['64'],
      trx,
    );
    expect(bankFeedSyncDb.updateAccountsFeedsActive).toHaveBeenCalledWith(
      BankFeedProvider.Wise,
      ['64'],
      true,
      trx,
    );
  });

  it('filters out already-synced transactions (idempotent re-sync)', async () => {
    feedItemQuery.forUpdate.mockResolvedValue(activeItem);
    wiseBankFeedProvider.fetchTransactionUpdates.mockResolvedValue({
      added: [
        {
          provider: BankFeedProvider.Wise,
          providerTransactionId: 'REF-1',
          providerAccountId: '64',
          date: '2026-08-05',
          amount: -25.5,
          currencyCode: 'EUR',
        },
        {
          provider: BankFeedProvider.Wise,
          providerTransactionId: 'REF-2',
          providerAccountId: '64',
          date: '2026-08-10',
          amount: 500,
          currencyCode: 'EUR',
        },
      ],
      modified: [],
      removedProviderTransactionIds: [],
      syncState: {},
    });
    // REF-1 already exists in the tenant database.
    uncategorizedQuery.select.mockResolvedValue([
      { bankFeedProviderTransactionId: 'REF-1' },
    ]);

    await buildService().sync(PROVIDER_ITEM_ID);

    expect(bankFeedSyncDb.syncAccountsTransactions).toHaveBeenCalledWith(
      BankFeedProvider.Wise,
      [expect.objectContaining({ providerTransactionId: 'REF-2' })],
      trx,
    );
  });

  it('flags the item as error on WiseAuthError without throwing', async () => {
    feedItemQuery.forUpdate.mockResolvedValue(activeItem);
    wiseBankFeedProvider.fetchAccounts.mockRejectedValue(new WiseAuthError());

    await expect(
      buildService().sync(PROVIDER_ITEM_ID),
    ).resolves.toBeUndefined();

    expect(feedItemQuery.patch).toHaveBeenCalledWith({ status: 'error' });
  });

  it('rethrows non-auth errors', async () => {
    feedItemQuery.forUpdate.mockResolvedValue(activeItem);
    const error = new Error('connection reset');
    wiseBankFeedProvider.fetchAccounts.mockRejectedValue(error);

    await expect(buildService().sync(PROVIDER_ITEM_ID)).rejects.toBe(error);
    expect(feedItemQuery.patch).not.toHaveBeenCalled();
  });
});
