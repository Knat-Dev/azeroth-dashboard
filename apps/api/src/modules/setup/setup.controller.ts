import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SetupService } from './setup.service.js';

@ApiTags('Setup')
@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @ApiOperation({ summary: 'Check if initial setup is needed' })
  @Get('status')
  async getStatus() {
    const needsSetup = await this.setupService.needsSetup();
    return { needsSetup };
  }

  @ApiOperation({ summary: 'Complete initial setup' })
  @Post('complete')
  async completeSetup(
    @Body()
    body: {
      username: string;
      password: string;
      email?: string;
      faction?: string;
      baseTheme?: string;
    },
  ) {
    if (!body.username || !body.password) {
      throw new BadRequestException('Username and password are required');
    }
    if (body.username.length < 3 || body.username.length > 16) {
      throw new BadRequestException(
        'Username must be between 3 and 16 characters',
      );
    }
    if (body.password.length < 6 || body.password.length > 16) {
      throw new BadRequestException(
        'Password must be between 6 and 16 characters',
      );
    }

    try {
      return await this.setupService.completeSetup(body);
    } catch (err) {
      if (err instanceof Error && err.message === 'Setup already completed') {
        throw new ForbiddenException('Setup has already been completed');
      }
      throw err;
    }
  }
}
