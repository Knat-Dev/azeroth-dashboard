import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GuildsService } from './guilds.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Guilds')
@ApiBearerAuth()
@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private guildsService: GuildsService) {}

  @ApiOperation({ summary: 'List guilds' })
  @Get()
  listGuilds(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.guildsService.listGuilds(
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
  }

  @ApiOperation({ summary: 'Get guild details' })
  @Get(':id')
  getGuildDetail(@Param('id', ParseIntPipe) id: number) {
    return this.guildsService.getGuildDetail(id);
  }
}
