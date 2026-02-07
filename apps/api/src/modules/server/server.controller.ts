import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServerService } from './server.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('server')
export class ServerController {
  constructor(private serverService: ServerService) {}

  @Get('status')
  getStatus() {
    return this.serverService.getStatus();
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
