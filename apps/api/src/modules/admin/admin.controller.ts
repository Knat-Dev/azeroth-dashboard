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
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service.js';
import { SoapService } from './soap.service.js';
import { DockerService } from '../docker/docker.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import { EventService } from '../monitor/event.service.js';
import { WebhookService } from '../webhook/webhook.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';
import { CreateAccountDto, BanAccountDto, ExecuteCommandDto } from './admin.dto.js';

@ApiTags('Admin')
@ApiBearerAuth()
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
    @Inject(forwardRef(() => WebhookService))
    private webhookService: WebhookService,
  ) {}

  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @ApiOperation({ summary: 'List accounts (paginated)' })
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

  @ApiOperation({ summary: 'Create a new account' })
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

  @ApiOperation({ summary: 'Update an account' })
  @Patch('accounts/:id')
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { expansion?: number },
  ) {
    return this.adminService.updateAccount(id, data);
  }

  @ApiOperation({ summary: 'Ban an account' })
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

  @ApiOperation({ summary: 'Unban an account' })
  @Delete('accounts/:id/ban')
  async unbanAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { username: string },
  ) {
    const result = await this.adminService.unbanAccount(id);
    this.eventService.logEvent('dashboard', 'account_unbanned', `Unbanned account #${id}`, undefined, user.username);
    return result;
  }

  @ApiOperation({ summary: 'List active bans' })
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

  @ApiOperation({ summary: 'Execute a SOAP command' })
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

  @ApiOperation({ summary: 'Restart a Docker container' })
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

  @ApiOperation({ summary: 'Get all settings' })
  @Get('settings')
  getSettings() {
    return this.eventService.getAllSettings();
  }

  @ApiOperation({ summary: 'Update settings' })
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

  @ApiOperation({ summary: 'Send a test webhook notification' })
  @Post('webhook/test')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  testWebhook() {
    return this.webhookService.sendTestNotification();
  }

  // --- IP Bans ---

  @ApiOperation({ summary: 'List active IP bans' })
  @Get('ip-bans')
  listIpBans(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listIpBans(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
  }

  @ApiOperation({ summary: 'Ban an IP address' })
  @Post('ip-bans')
  async createIpBan(
    @CurrentUser() user: { username: string },
    @Body() body: { ip: string; reason: string; duration: number },
  ) {
    const result = await this.adminService.createIpBan(
      body.ip,
      user.username,
      body.reason,
      body.duration,
    );
    this.eventService.logEvent('dashboard', 'ip_banned', `Banned IP ${body.ip}: ${body.reason}`, undefined, user.username);
    return result;
  }

  @ApiOperation({ summary: 'Remove an IP ban' })
  @Delete('ip-bans/:ip')
  async removeIpBan(
    @CurrentUser() user: { username: string },
    @Param('ip') ip: string,
  ) {
    const result = await this.adminService.removeIpBan(ip);
    this.eventService.logEvent('dashboard', 'ip_unbanned', `Unbanned IP ${ip}`, undefined, user.username);
    return result;
  }

  // --- Password Reset ---

  @ApiOperation({ summary: 'Reset account password' })
  @Put('accounts/:id/password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { username: string },
    @Body() body: { password: string },
  ) {
    const result = await this.adminService.resetPassword(id, body.password);
    this.eventService.logEvent('dashboard', 'password_reset', `Reset password for account #${id}`, undefined, user.username);
    return result;
  }
}
