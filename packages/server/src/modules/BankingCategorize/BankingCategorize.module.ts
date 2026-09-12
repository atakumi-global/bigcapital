import { forwardRef, Module } from '@nestjs/common';
import { CreateUncategorizedTransactionService } from './commands/CreateUncategorizedTransaction.service';
import { CategorizeTransactionAsExpense } from './commands/CategorizeTransactionAsExpense';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { BankingMatchingModule } from '../BankingMatching/BankingMatching.module';
import { ExpensesModule } from '../Expenses/Expenses.module';
import { UncategorizedTransactionsImportable } from './commands/UncategorizedTransactionsImportable';
import { BankingCategorizeController } from './BankingCategorize.controller';
import { BankingCategorizeApplication } from './BankingCategorize.application';
import { CategorizeBankTransaction } from './commands/CategorizeBankTransaction';
import { UncategorizeBankTransactionService } from './commands/UncategorizeBankTransaction.service';
import { UncategorizeBankTransactionsBulk } from './commands/UncategorizeBankTransactionsBulk.service';

@Module({
  imports: [
    BankingTransactionsModule,
    BankingMatchingModule,
    ExpensesModule,
    forwardRef(() => BankingTransactionsModule),
  ],
  providers: [
    CreateUncategorizedTransactionService,
    CategorizeTransactionAsExpense,
    UncategorizedTransactionsImportable,
    BankingCategorizeApplication,
    CategorizeBankTransaction,
    UncategorizeBankTransactionService,
    UncategorizeBankTransactionsBulk,
  ],
  exports: [
    CreateUncategorizedTransactionService,
    CategorizeTransactionAsExpense,
    BankingCategorizeApplication,
    CategorizeBankTransaction,
    UncategorizeBankTransactionService,
    UncategorizeBankTransactionsBulk,
  ],
  controllers: [BankingCategorizeController],
})
export class BankingCategorizeModule {}
