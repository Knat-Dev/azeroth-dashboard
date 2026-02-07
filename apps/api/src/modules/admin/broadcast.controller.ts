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
import { BroadcastService } from './broadcast.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class BroadcastController {
  constructor(private broadcastService: BroadcastService) {}

  @Post('broadcast')
  sendBroadcast(
    @CurrentUser() user: { id: number; username: string },
    @Body() body: { message: string; type: 'announce' | 'notify' | 'both' },
  ) {
    return this.broadcastService.sendBroadcast(body.message, body.type, user.id, user.username);
  }

  @Get('autobroadcast')
  listAutobroadcasts() {
    return this.broadcastService.listAutobroadcasts();
  }

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

  @Patch('autobroadcast/:id')
  updateAutobroadcast(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { text?: string; weight?: number },
  ) {
    return this.broadcastService.updateAutobroadcast(id, body);
  }

  @Delete('autobroadcast/:id')
  deleteAutobroadcast(@Param('id', ParseIntPipe) id: number) {
    return this.broadcastService.deleteAutobroadcast(id);
  }

  @Post('autobroadcast/reload')
  reloadAutobroadcast(@CurrentUser() user: { id: number; username: string }) {
    return this.broadcastService.reloadAutobroadcast(user.id, user.username);
  }
}
