import * as fs from 'fs';
import * as path from 'path';
import { ACCOUNT_TYPE } from '@/constants/accounts';
import { BankFeedProvider } from '../BankingFeeds/BankFeedProvider.types';
import { WiseBalance, WiseStatementTransaction } from '../Wise/Wise.types';
import {
  getWiseBalanceAccountName,
  getWiseProviderTransactionId,
  isSyncableWiseBalance,
  transformWiseAccountToCreateAccount,
  transformWiseBalanceToBankFeedAccount,
  transformWiseStatementTxnToBankFeedTransaction,
} from './BankingWise.utils';

const loadFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../../test/fixtures/wise', name),
      'utf-8',
    ),
  );

const balancesFixture = loadFixture('balances.json') as WiseBalance[];
const statementEurFixture = loadFixture('statement-eur.json');
const statementNoRefFixture = loadFixture('statement-usd-no-reference.json');

describe('BankingWise.utils', () => {
  describe('isSyncableWiseBalance', () => {
    it('keeps visible, non-invested STANDARD and SAVINGS balances only', () => {
      const syncable = balancesFixture.filter(isSyncableWiseBalance);

      expect(syncable.map((balance) => balance.id)).toEqual([64, 65, 66]);
    });

    it('rejects invisible and invested balances', () => {
      const invisible = balancesFixture.find((balance) => balance.id === 67);
      const invested = balancesFixture.find((balance) => balance.id === 68);

      expect(isSyncableWiseBalance(invisible!)).toBe(false);
      expect(isSyncableWiseBalance(invested!)).toBe(false);
    });
  });

  describe('getWiseBalanceAccountName', () => {
    it('names standard balances by currency', () => {
      const eur = balancesFixture.find((balance) => balance.id === 64)!;

      expect(getWiseBalanceAccountName(eur)).toBe('Wise — EUR');
    });

    it('names savings jars with the jar name and currency', () => {
      const jar = balancesFixture.find((balance) => balance.id === 66)!;

      expect(getWiseBalanceAccountName(jar)).toBe('Wise — Rainy day jar (NZD)');
    });
  });

  describe('transformWiseBalanceToBankFeedAccount', () => {
    it('maps the balance to a provider-neutral bank feed account', () => {
      const eur = balancesFixture.find((balance) => balance.id === 64)!;
      const account = transformWiseBalanceToBankFeedAccount(eur);

      expect(account).toEqual({
        providerAccountId: '64',
        name: 'Wise — EUR',
        currencyCode: 'EUR',
        accountType: ACCOUNT_TYPE.BANK,
        currentBalance: 1520.42,
      });
    });
  });

  describe('transformWiseAccountToCreateAccount', () => {
    it('maps to a create account DTO with the Wise feed trio and empty code', () => {
      const eur = balancesFixture.find((balance) => balance.id === 64)!;
      const account = transformWiseBalanceToBankFeedAccount(eur);
      const dto = transformWiseAccountToCreateAccount(account, 12345);

      expect(dto).toMatchObject({
        name: 'Wise — EUR',
        code: '',
        accountType: ACCOUNT_TYPE.BANK,
        active: true,
        currencyCode: 'EUR',
        bankBalance: 1520.42,
        bankFeedProvider: BankFeedProvider.Wise,
        bankFeedProviderItemId: '12345',
        bankFeedProviderAccountId: '64',
      });
      // The deprecated Plaid aliases must not be set.
      expect((dto as any).plaidAccountId).toBeUndefined();
      expect((dto as any).plaidItemId).toBeUndefined();
    });
  });

  describe('transformWiseStatementTxnToBankFeedTransaction', () => {
    const transactions =
      statementEurFixture.transactions as WiseStatementTransaction[];

    it('keeps the Wise sign convention (money in positive, out negative)', () => {
      const [debit, credit] = transactions.map((txn) =>
        transformWiseStatementTxnToBankFeedTransaction(txn, 64),
      );

      expect(debit.amount).toBe(-25.5);
      expect(credit.amount).toBe(500);
    });

    it('truncates the ISO timestamp to a date-only value', () => {
      const txn = transformWiseStatementTxnToBankFeedTransaction(
        transactions[0],
        64,
      );

      expect(txn.date).toBe('2026-08-05');
    });

    it('uses the reference number as provider transaction id', () => {
      const txn = transformWiseStatementTxnToBankFeedTransaction(
        transactions[0],
        64,
      );

      expect(txn.providerTransactionId).toBe('CARD-REF-0001');
    });

    it('maps payee from the merchant, sender and recipient details', () => {
      const [card, incoming, outgoing] = transactions.map((txn) =>
        transformWiseStatementTxnToBankFeedTransaction(txn, 64),
      );

      expect(card.payee).toBe('Coffee Shop');
      expect(incoming.payee).toBe('Acme GmbH');
      expect(outgoing.payee).toBe('Supplier Oy');
    });

    it('maps description, reference number and pending flag', () => {
      const txn = transformWiseStatementTxnToBankFeedTransaction(
        transactions[1],
        64,
      );

      expect(txn.description).toBe('Invoice 1042 payment');
      expect(txn.referenceNo).toBe('INV-1042');
      expect(txn.pending).toBe(false);
      expect(txn.provider).toBe(BankFeedProvider.Wise);
      expect(txn.providerAccountId).toBe('64');
      expect(txn.currencyCode).toBe('EUR');
    });

    it('falls back to a stable sha1 fingerprint when referenceNumber is missing', () => {
      const txn = statementNoRefFixture
        .transactions[0] as WiseStatementTransaction;

      const first = transformWiseStatementTxnToBankFeedTransaction(txn, 65);
      const second = transformWiseStatementTxnToBankFeedTransaction(txn, 65);

      expect(first.providerTransactionId).toMatch(/^[0-9a-f]{40}$/);
      expect(first.providerTransactionId).toEqual(second.providerTransactionId);
      expect(getWiseProviderTransactionId(txn)).toEqual(
        first.providerTransactionId,
      );
    });
  });
});
