import {
  Item as PlaidItem,
  Institution as PlaidInstitution,
  AccountBase as PlaidAccount,
  Transaction as PlaidTransaction,
  TransactionBase as PlaidTransactionBase,
  AccountType as PlaidAccountType,
} from 'plaid';
import { ACCOUNT_TYPE } from '@/constants/accounts';
import { IAccountCreateDTO } from '@/interfaces/Account';
import { CreateUncategorizedTransactionDTO } from '../BankingCategorize/types/BankingCategorize.types';
import {
  BankFeedProvider,
  BankFeedTransaction,
} from '../BankingFeeds/BankFeedProvider.types';

/**
 * Retrieves the system account type from the given Plaid account type.
 * @param {PlaidAccountType} plaidAccountType
 * @returns {string}
 */
const getAccountTypeFromPlaidAccountType = (
  plaidAccountType: PlaidAccountType,
) => {
  if (plaidAccountType === PlaidAccountType.Credit) {
    return ACCOUNT_TYPE.CREDIT_CARD;
  }
  return ACCOUNT_TYPE.BANK;
};

/**
 * Transformes the Plaid account to create cashflow account DTO.
 * @param {PlaidItem} item - Plaid item.
 * @param {PlaidInstitution} institution - Plaid institution.
 * @param {PlaidAccount} plaidAccount - Plaid account.
 * @returns {IAccountCreateDTO}
 */
export const transformPlaidAccountToCreateAccount = (
  item: PlaidItem,
  institution: PlaidInstitution,
  plaidAccount: PlaidAccount,
): IAccountCreateDTO => {
  return {
    name: `${institution.name} - ${plaidAccount.name}`,
    code: '',
    description: plaidAccount.official_name,
    currencyCode: plaidAccount.balances.iso_currency_code,
    accountType: getAccountTypeFromPlaidAccountType(plaidAccount.type),
    active: true,
    bankBalance: plaidAccount.balances.current,
    accountMask: plaidAccount.mask,

    // Deprecated Plaid aliases kept while old readers/writers migrate.
    plaidAccountId: plaidAccount.account_id,
    plaidItemId: item.item_id,

    bankFeedProvider: BankFeedProvider.Plaid,
    bankFeedProviderAccountId: plaidAccount.account_id,
    bankFeedProviderItemId: item.item_id,
  };
};

/**
 * Transformes the plaid transaction to cashflow create DTO.
 * @param {number} cashflowAccountId - Cashflow account ID.
 * @param {number} creditAccountId - Credit account ID.
 * @param {PlaidTransaction} plaidTranasction - Plaid transaction.
 * @returns {CreateUncategorizedTransactionDTO}
 */
export const transformPlaidTrxsToCashflowCreate = (
  cashflowAccountId: number,
  plaidTranasction: PlaidTransactionBase,
): CreateUncategorizedTransactionDTO => {
  return {
    date: plaidTranasction.date,

    // Plaid: Positive values when money moves out of the account; negative values
    // when money moves in. For example, debit card purchases are positive;
    // credit card payments, direct deposits, and refunds are negative.
    amount: -1 * plaidTranasction.amount,

    description: plaidTranasction.name,
    payee: plaidTranasction.payment_meta?.payee,
    currencyCode: plaidTranasction.iso_currency_code,
    accountId: cashflowAccountId,
    referenceNo: plaidTranasction.payment_meta?.reference_number,

    // Deprecated Plaid aliases kept while old readers/writers migrate.
    plaidTransactionId: plaidTranasction.transaction_id,
    pendingPlaidTransactionId: plaidTranasction.pending_transaction_id,

    bankFeedProvider: BankFeedProvider.Plaid,
    bankFeedProviderTransactionId: plaidTranasction.transaction_id,
    pending: plaidTranasction.pending,
    pendingBankFeedProviderTransactionId:
      plaidTranasction.pending_transaction_id,
  };
};

/**
 * Transforms a Plaid transaction to a provider-neutral bank feed transaction.
 * Amount is normalized to Bigcapital sign convention: money in = positive.
 */
export const transformPlaidTrxToBankFeedTransaction = (
  plaidTranasction: PlaidTransaction,
): BankFeedTransaction => {
  return {
    provider: BankFeedProvider.Plaid,
    providerTransactionId: plaidTranasction.transaction_id,
    providerAccountId: plaidTranasction.account_id,
    date: plaidTranasction.date,
    amount: -1 * plaidTranasction.amount,
    description: plaidTranasction.name,
    payee: plaidTranasction.payment_meta?.payee,
    currencyCode: plaidTranasction.iso_currency_code,
    referenceNo: plaidTranasction.payment_meta?.reference_number,
    pending: plaidTranasction.pending,
    pendingProviderTransactionId: plaidTranasction.pending_transaction_id,
  };
};
