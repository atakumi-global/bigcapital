import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WiseItemService } from './WiseItem.service';
import { WiseSyncEnqueueService } from './WiseSyncEnqueue.service';
import { ConnectWiseDto, SyncWiseDto } from './dtos/ConnectWise.dto';

@Controller('banking/wise')
@ApiTags('Banking Wise')
export class BankingWiseController {
  constructor(
    private readonly wiseItemService: WiseItemService,
    private readonly wiseSyncEnqueueService: WiseSyncEnqueueService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get the Wise integration status' })
  getStatus() {
    return this.wiseItemService.getStatus();
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List the Wise profiles of the configured token' })
  getProfiles() {
    return this.wiseItemService.getProfiles();
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect a Wise profile' })
  connect(@Body() connectDTO?: ConnectWiseDto) {
    return this.wiseItemService.connect(connectDTO);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Enqueue a Wise transactions sync' })
  async sync(@Body() syncDTO?: SyncWiseDto) {
    const item = await this.wiseItemService.getTenantWiseItem();

    if (!item) {
      throw new NotFoundException('Wise is not connected.');
    }
    // A new start date resets the cursors before the sync runs.
    if (syncDTO?.syncStartDate) {
      await this.wiseItemService.setSyncStartDate(syncDTO.syncStartDate);
    }
    await this.wiseSyncEnqueueService.enqueue(item.providerItemId);
  }

  @Post('pause')
  @ApiOperation({ summary: 'Pause the Wise feed sync' })
  pause() {
    return this.wiseItemService.pause();
  }

  @Post('resume')
  @ApiOperation({ summary: 'Resume the Wise feed sync' })
  resume() {
    return this.wiseItemService.resume();
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect the Wise profile' })
  disconnect() {
    return this.wiseItemService.disconnect();
  }
}
