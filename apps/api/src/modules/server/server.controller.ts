import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServerService } from './server.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import { EventService } from '../monitor/event.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('server')
export class ServerController {
  constructor(
    private serverService: ServerService,
    private monitorService: MonitorService,
    private eventService: EventService,
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

  @Get('events')
  @UseGuards(JwtAuthGuard)
  getEvents(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('container') container?: string,
  ) {
    // Paginated if page param is provided
    if (page) {
      return this.eventService.getEventsPaginated(
        parseInt(page, 10),
        parseInt(limit ?? '20', 10),
        container,
      );
    }
    return this.eventService.getEvents(
      parseInt(limit ?? '50', 10),
      container,
    );
  }

  @Get('player-history')
  @UseGuards(JwtAuthGuard)
  getPlayerHistory(@Query('range') range?: string) {
    const validRanges = ['24h', '7d', '30d'] as const;
    const r = validRanges.includes(range as typeof validRanges[number])
      ? (range as '24h' | '7d' | '30d')
      : '24h';
    return this.eventService.getPlayerHistory(r);
  }

  @Get('players')
  @UseGuards(JwtAuthGuard)
  getOnlinePlayers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.serverService.getOnlinePlayers(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
      search,
    );
  }
}
