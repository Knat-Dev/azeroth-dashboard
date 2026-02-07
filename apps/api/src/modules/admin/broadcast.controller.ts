import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BroadcastService } from './broadcast.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@ApiTags('Broadcasts')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class BroadcastController {
  constructor(private broadcastService: BroadcastService) {}

  @ApiOperation({ summary: 'Send a broadcast message' })
  @Post('broadcast')
  sendBroadcast(
    @Body() body: { message: string; type: 'announce' | 'notify' | 'both' },
  ) {
    return this.broadcastService.sendBroadcast(body.message, body.type);
  }

  @ApiOperation({ summary: 'List autobroadcasts' })
  @Get('autobroadcast')
  listAutobroadcasts() {
    return this.broadcastService.listAutobroadcasts();
  }

  @ApiOperation({ summary: 'Create an autobroadcast' })
  @Post('autobroadcast')
  createAutobroadcast(
    @Body() body: { text: string; weight?: number; realmid?: number },
  ) {
    return this.broadcastService.createAutobroadcast(
      body.text,
      body.weight,
      body.realmid,
    );
  }

  @ApiOperation({ summary: 'Update an autobroadcast' })
  @Patch('autobroadcast/:id')
  updateAutobroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { text?: string; weight?: number },
  ) {
    return this.broadcastService.updateAutobroadcast(id, body);
  }

  @ApiOperation({ summary: 'Delete an autobroadcast' })
  @Delete('autobroadcast/:id')
  deleteAutobroadcast(@Param('id', ParseIntPipe) id: number) {
    return this.broadcastService.deleteAutobroadcast(id);
  }

  @ApiOperation({ summary: 'Reload autobroadcasts' })
  @Post('autobroadcast/reload')
  reloadAutobroadcast() {
    return this.broadcastService.reloadAutobroadcast();
  }
}
