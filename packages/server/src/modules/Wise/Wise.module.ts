import axios from 'axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WiseClient } from './Wise.client';
import { WISE_CLIENT } from './Wise.constants';

export { WISE_CLIENT };

@Module({
  providers: [
    {
      provide: WISE_CLIENT,
      useFactory: (configService: ConfigService) => {
        return axios.create({
          baseURL: configService.get('wise.apiBaseUrl'),
          headers: {
            Authorization: `Bearer ${configService.get('wise.apiToken')}`,
            'Content-Type': 'application/json',
          },
        });
      },
      inject: [ConfigService],
    },
    WiseClient,
  ],
  exports: [WISE_CLIENT, WiseClient],
})
export class WiseModule {}
