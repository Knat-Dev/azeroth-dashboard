import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServerService } from './server.service.js';
import { MonitorService } from '../monitor/monitor.service.js';
import { EventService } from '../monitor/event.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Server')
@ApiBearerAuth()
@Controller('server')
export class ServerController {
  constructor(
    private serverService: ServerService,
    private monitorService: MonitorService,
    private eventService: EventService,
  ) {}

  @ApiOperation({ summary: 'Get server status' })
  @Get('status')
  getStatus() {
    return this.serverService.getStatus();
  }

  @ApiOperation({ summary: 'Get server health' })
  @Get('health')
  @UseGuards(JwtAuthGuard)
  getHealth() {
    return this.monitorService.getHealth();
  }

  @ApiOperation({ summary: 'Get server stats' })
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.serverService.getStats();
  }

  @ApiOperation({ summary: 'List realms' })
  @Get('realms')
  getRealms() {
    return this.serverService.getRealms();
  }

  @ApiOperation({ summary: 'Get server events' })
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
    return this.eventService.getEvents(parseInt(limit ?? '50', 10), container);
  }

  @ApiOperation({ summary: 'Get player count history' })
  @Get('player-history')
  @UseGuards(JwtAuthGuard)
  getPlayerHistory(@Query('range') range?: string) {
    const validRanges = ['24h', '7d', '30d'] as const;
    const r = validRanges.includes(range as (typeof validRanges)[number])
      ? (range as '24h' | '7d' | '30d')
      : '24h';
    return this.eventService.getPlayerHistory(r);
  }

  @ApiOperation({ summary: 'List online players' })
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

  @ApiOperation({ summary: 'Get player detail by GUID' })
  @Get('players/:guid')
  @UseGuards(JwtAuthGuard)
  getPlayerDetail(@Param('guid', ParseIntPipe) guid: number) {
    return this.serverService.getPlayerDetail(guid);
  }

  @ApiOperation({ summary: 'Get class/race distribution' })
  @Get('stats/distribution')
  @UseGuards(JwtAuthGuard)
  getDistribution() {
    return this.serverService.getDistribution();
  }

  @ApiOperation({ summary: 'Batch lookup item templates by entry IDs' })
  @Post('items/batch')
  @UseGuards(JwtAuthGuard)
  getItemTemplates(@Body() body: { entries: number[] }) {
    const entries = Array.isArray(body.entries) ? body.entries : [];
    return this.serverService.getItemTemplates(entries);
  }
}
