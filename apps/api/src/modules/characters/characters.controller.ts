import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CharactersService } from './characters.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@ApiTags('Characters')
@ApiBearerAuth()
@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  constructor(private charactersService: CharactersService) {}

  @ApiOperation({ summary: "Get current user's characters" })
  @Get()
  getMyCharacters(@CurrentUser() user: { id: number }) {
    return this.charactersService.getMyCharacters(user.id);
  }

  @ApiOperation({ summary: 'Search characters by name' })
  @Get('search')
  searchCharacters(@Query('name') name: string) {
    return this.charactersService.searchCharacters(name ?? '');
  }

  @ApiOperation({ summary: 'Get character details' })
  @Get(':guid')
  getCharacterDetail(
    @Param('guid', ParseIntPipe) guid: number,
    @CurrentUser() user: { id: number; gmLevel: number },
  ) {
    return this.charactersService.getCharacterDetail(
      guid,
      user.id,
      user.gmLevel >= GmLevel.ADMINISTRATOR,
    );
  }

  @ApiOperation({ summary: 'Get character inventory' })
  @Get(':guid/inventory')
  getCharacterInventory(
    @Param('guid', ParseIntPipe) guid: number,
    @CurrentUser() user: { id: number; gmLevel: number },
  ) {
    return this.charactersService.getCharacterInventory(
      guid,
      user.id,
      user.gmLevel >= GmLevel.ADMINISTRATOR,
    );
  }
}
