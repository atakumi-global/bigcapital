import { registerAs } from '@nestjs/config';

export default registerAs('wise', () => ({
  apiToken: process.env.WISE_API_TOKEN,
  apiBaseUrl: process.env.WISE_API_BASE_URL || 'https://api.wise.com',
  profileId: process.env.WISE_PROFILE_ID,
  webhookSecret: process.env.WISE_WEBHOOK_SECRET,
}));
