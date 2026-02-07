import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { SoapService } from './soap.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private soapService: SoapService,
  ) {}

  @Get('accounts')
  listAccounts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listAccounts(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
  }

  @Patch('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { expansion?: number },
  ) {
    return this.adminService.updateAccount(id, data);
  }

  @Post('accounts/:id/ban')
  banAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { username: string },
    @Body() body: { reason: string; duration: number },
  ) {
    return this.adminService.banAccount(
      id,
      user.username,
      body.reason,
      body.duration,
    );
  }

  @Delete('accounts/:id/ban')
  unbanAccount(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.unbanAccount(id);
  }

  @Get('bans')
  listBans() {
    return this.adminService.listBans();
  }

  @Post('command')
  executeCommand(
    @CurrentUser() user: { id: number; username: string },
    @Body() body: { command: string },
  ) {
    return this.soapService.executeCommand(body.command, user.id, user.username);
  }
}
