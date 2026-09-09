export interface WiseProfile {
  id: number;
  type: 'personal' | 'business';
  details?: Record<string, any>;
}

export interface WiseAmount {
  value: number;
  currency: string;
}

export interface WiseBalance {
  id: number;
  currency: string;
  type: 'STANDARD' | 'SAVINGS' | string;
  name?: string;
  visible?: boolean;
  investmentState?: string;
  amount: WiseAmount;
}

export interface WiseStatementTransactionDetails {
  type?: string;
  description?: string;
  paymentReference?: string;
  merchant?: { name?: string; category?: string };
  senderName?: string;
  senderAccount?: string;
  recipient?: { name?: string; account?: string };
  [key: string]: any;
}

export interface WiseStatementTransaction {
  type: 'DEBIT' | 'CREDIT' | string;
  date: string;
  amount: WiseAmount;
  totalFees?: WiseAmount;
  details?: WiseStatementTransactionDetails;
  exchangeDetails?: {
    forAmount?: WiseAmount;
    rate?: number | null;
  } | null;
  runningBalance?: WiseAmount;
  referenceNumber?: string;
}

export interface WiseBalanceStatement {
  accountHolder?: Record<string, any>;
  issuer?: Record<string, any>;
  query?: Record<string, any>;
  transactions: WiseStatementTransaction[];
}

export interface GetWiseBalanceStatementParams {
  currency: string;
  intervalStart: string;
  intervalEnd: string;
}
