import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';
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

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Import transactions since this date (ISO 8601). Defaults to 90 days ago. The Wise statement window is hard-capped at 469 days.',
  })
  syncStartDate?: string;
}

export class SyncWiseDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Resets the sync cursor and re-imports transactions since this date (ISO 8601). Hard-capped at 469 days back.',
  })
  syncStartDate?: string;
}
