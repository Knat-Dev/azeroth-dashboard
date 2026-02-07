import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { GuildsService } from './guilds.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @Get()
  listGuilds(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.guildsService.listGuilds(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
  }

  @Get(':id')
  getGuildDetail(@Param('id', ParseIntPipe) id: number) {
    return this.guildsService.getGuildDetail(id);
  }
}
