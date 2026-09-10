import { createHash } from 'crypto';
import { ACCOUNT_TYPE } from '@/constants/accounts';
import { IAccountCreateDTO } from '@/interfaces/Account';
import {
  BankFeedAccount,
  BankFeedProvider,
  BankFeedTransaction,
} from '../BankingFeeds/BankFeedProvider.types';
import { WiseBalance, WiseStatementTransaction } from '../Wise/Wise.types';

/**
 * Determines whether the Wise balance is eligible for syncing. Only visible,
 * non-invested standard balances and savings jars support statements.
 * @param {WiseBalance} balance - Wise balance.
 * @returns {boolean}
 */
export const isSyncableWiseBalance = (balance: WiseBalance): boolean => {
  const syncableTypes = ['STANDARD', 'SAVINGS'];

  return (
    syncableTypes.includes(balance.type) &&
    balance.visible === true &&
    balance.investmentState === 'NOT_INVESTED'
  );
};

/**
 * Composes the Bigcapital account name of the given Wise balance. Named
 * balances (jars) include the jar name to stay distinguishable; unnamed
 * balances go by currency.
 * @param {WiseBalance} balance - Wise balance.
 * @returns {string}
 */
export const getWiseBalanceAccountName = (balance: WiseBalance): string => {
  return balance.name
    ? `Wise — ${balance.name} (${balance.currency})`
    : `Wise — ${balance.currency}`;
};

/**
 * Transforms a Wise balance to a provider-neutral bank feed account.
 * @param {WiseBalance} balance - Wise balance.
 * @returns {BankFeedAccount}
 */
export const transformWiseBalanceToBankFeedAccount = (
  balance: WiseBalance,
): BankFeedAccount => {
  return {
    providerAccountId: String(balance.id),
    name: getWiseBalanceAccountName(balance),
    currencyCode: balance.currency,
    accountType: ACCOUNT_TYPE.BANK,
    currentBalance: balance.amount.value,
  };
};

/**
 * Transforms a provider-neutral Wise bank feed account to a create cashflow
 * account DTO. Each Wise currency balance becomes its own (single-currency)
 * Bigcapital bank account.
 * @param {BankFeedAccount} account - Wise bank feed account.
 * @param {number | string} profileId - Wise profile id.
 * @returns {IAccountCreateDTO}
 */
export const transformWiseAccountToCreateAccount = (
  account: BankFeedAccount,
  profileId: number | string,
): IAccountCreateDTO => {
  return {
    name: account.name,
    code: '',
    description: account.officialName || '',
    accountType: ACCOUNT_TYPE.BANK,
    active: true,
    currencyCode: account.currencyCode,
    bankBalance: account.currentBalance,

    bankFeedProvider: BankFeedProvider.Wise,
    bankFeedProviderItemId: String(profileId),
    bankFeedProviderAccountId: account.providerAccountId,
  };
};

/**
 * Derives a stable provider transaction id. Falls back to a sha1 hash of the
 * transaction content when Wise does not expose a `referenceNumber`.
 * @param {WiseStatementTransaction} txn - Wise statement transaction.
 * @returns {string}
 */
export const getWiseProviderTransactionId = (
  txn: WiseStatementTransaction,
): string => {
  if (txn.referenceNumber) {
    return txn.referenceNumber;
  }
  const fingerprint = [
    txn.date,
    txn.amount?.value,
    txn.runningBalance?.value ?? '',
    txn.details?.description ?? '',
  ].join('|');

  return createHash('sha1').update(fingerprint).digest('hex');
};

/**
 * Derives the payee of the Wise statement transaction from its details.
 * @param {WiseStatementTransaction} txn - Wise statement transaction.
 * @returns {string | null}
 */
const getWiseTransactionPayee = (
  txn: WiseStatementTransaction,
): string | null => {
  const details = txn.details;

  return (
    details?.merchant?.name ||
    details?.senderName ||
    details?.recipient?.name ||
    null
  );
};

/**
 * Transforms a Wise statement transaction to a provider-neutral bank feed
 * transaction. Wise statement amounts are already signed (money in positive,
 * money out negative), matching the `BankFeedSyncDb` convention.
 * @param {WiseStatementTransaction} txn - Wise statement transaction.
 * @param {number | string} balanceId - Wise balance id.
 * @returns {BankFeedTransaction}
 */
export const transformWiseStatementTxnToBankFeedTransaction = (
  txn: WiseStatementTransaction,
  balanceId: number | string,
): BankFeedTransaction => {
  return {
    provider: BankFeedProvider.Wise,
    providerTransactionId: getWiseProviderTransactionId(txn),
    providerAccountId: String(balanceId),
    date: txn.date,
    amount: txn.amount.value,
    currencyCode: txn.amount.currency,
    description: txn.details?.description || '',
    payee: getWiseTransactionPayee(txn),
    referenceNo: txn.details?.paymentReference || null,
    pending: false,
  };
};
