import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UncategorizedBankTransactionDto {
  @IsDateString()
  date: Date | string;

  @IsNumber()
  accountId: number;

  @IsNumber()
  amount: number;

  @IsString()
  currencyCode: string;

  @IsString()
  payee?: string;

  @IsString()
  description?: string;

  @IsString()
  referenceNo?: string | null;

  @IsString()
  plaidTransactionId?: string | null;

  @IsBoolean()
  pending?: boolean;

  @IsString()
  pendingPlaidTransactionId?: string | null;

  @IsOptional()
  @IsString()
  bankFeedProvider?: string;

  @IsOptional()
  @IsString()
  bankFeedProviderTransactionId?: string | null;

  @IsOptional()
  @IsString()
  pendingBankFeedProviderTransactionId?: string | null;

  @IsString()
  batch?: string;
}
