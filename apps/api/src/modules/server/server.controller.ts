import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServerService } from './server.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('server')
export class ServerController {
  constructor(
    private serverService: ServerService,
    private monitorService: MonitorService,
  ) {}

  @Get('status')
  getStatus() {
    return this.serverService.getStatus();
  }

  @Get('health')
  @UseGuards(JwtAuthGuard)
  getHealth() {
    return this.monitorService.getHealth();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.serverService.getStats();
  }

  @Get('realms')
  getRealms() {
    return this.serverService.getRealms();
  }
}
