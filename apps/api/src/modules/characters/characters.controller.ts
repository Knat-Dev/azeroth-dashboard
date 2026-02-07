import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CharactersService } from './characters.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  constructor(private charactersService: CharactersService) {}

  @Get()
  getMyCharacters(@CurrentUser() user: { id: number }) {
    return this.charactersService.getMyCharacters(user.id);
  }

  @Get('search')
  searchCharacters(@Query('name') name: string) {
    return this.charactersService.searchCharacters(name ?? '');
  }

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
