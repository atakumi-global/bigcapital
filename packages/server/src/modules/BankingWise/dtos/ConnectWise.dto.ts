import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ConnectWiseDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({
    example: 12345,
    description:
      'The Wise profile id to connect. Falls back to WISE_PROFILE_ID, then to the only profile of the token.',
  })
  profileId?: number;
}
