import { Module } from '@nestjs/common';
import { WiseBankFeedProvider } from './WiseBankFeedProvider';

@Module({
  providers: [WiseBankFeedProvider],
  exports: [WiseBankFeedProvider],
})
export class BankingWiseModule {}
