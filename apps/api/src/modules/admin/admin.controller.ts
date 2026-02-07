import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service.js';
import { SoapService } from './soap.service.js';
import { DockerService } from '../docker/docker.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import { EventService } from '../monitor/event.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';
import { CreateAccountDto, BanAccountDto, ExecuteCommandDto } from './admin.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private soapService: SoapService,
    private dockerService: DockerService,
    private monitorService: MonitorService,
    private eventService: EventService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('accounts')
  listAccounts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listAccounts(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
      search,
    );
  }

  @Post('accounts')
  async createAccount(
    @CurrentUser() user: { username: string },
    @Body() body: CreateAccountDto,
  ) {
    const result = await this.adminService.createAccount(
      body.username,
      body.password,
      body.email,
      body.expansion,
      body.gmLevel,
    );
    this.eventService.logEvent('dashboard', 'account_created', `Created account: ${body.username}`, undefined, user.username);
    return result;
  }

  @Patch('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { expansion?: number },
  ) {
    return this.adminService.updateAccount(id, data);
  }

  @Post('accounts/:id/ban')
  async banAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { username: string },
    @Body() body: BanAccountDto,
  ) {
    const result = await this.adminService.banAccount(
      id,
      user.username,
      body.reason,
      body.duration,
    );
    this.eventService.logEvent('dashboard', 'account_banned', `Banned account #${id}: ${body.reason}`, undefined, user.username);
    return result;
  }

  @Delete('accounts/:id/ban')
  async unbanAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { username: string },
  ) {
    const result = await this.adminService.unbanAccount(id);
    this.eventService.logEvent('dashboard', 'account_unbanned', `Unbanned account #${id}`, undefined, user.username);
    return result;
  }

  @Get('bans')
  listBans(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listBans(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
      search,
    );
  }

  @Post('command')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async executeCommand(
    @CurrentUser() user: { username: string },
    @Body() body: ExecuteCommandDto,
  ) {
    const result = await this.soapService.executeCommand(body.command);
    this.eventService.logEvent('ac-worldserver', 'soap_command', body.command, undefined, user.username);
    return result;
  }

  @Post('restart/:container')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async restartContainer(
    @CurrentUser() user: { username: string },
    @Param('container') container: string,
  ) {
    this.eventService.logEvent(container, 'manual_restart', `Manual restart by admin`, undefined, user.username);
    this.monitorService.clearCrashLoop(container);
    return this.dockerService.restartContainer(container);
  }

  @Get('settings')
  getSettings() {
    return this.eventService.getAllSettings();
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: { username: string },
    @Body() body: Record<string, string>,
  ) {
    for (const [key, value] of Object.entries(body)) {
      this.eventService.setSetting(key, value);
    }
    this.eventService.logEvent('dashboard', 'settings_updated', `Keys: ${Object.keys(body).join(', ')}`, undefined, user.username);
    // Reload runtime config in monitor + webhook services
    this.monitorService.reloadAllSettings();
    return { success: true };
  }
}
