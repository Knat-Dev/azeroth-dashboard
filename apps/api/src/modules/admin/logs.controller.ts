import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { LogsService } from './logs.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('admin/logs')
export class LogsController {
  constructor(
    private logsService: LogsService,
    private jwtService: JwtService,
  ) {}

  @ApiOperation({ summary: 'List Docker containers' })
  @Get('containers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GmLevel.ADMINISTRATOR)
  listContainers() {
    return this.logsService.listContainers();
  }

  @ApiOperation({ summary: 'Get container logs' })
  @Get('containers/:name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GmLevel.ADMINISTRATOR)
  getContainerLogs(
    @Param('name') name: string,
    @Query('tail') tail?: string,
  ) {
    return this.logsService.getContainerLogs(
      name,
      tail ? parseInt(tail, 10) : 500,
    );
  }

  /**
   * SSE endpoint for streaming container logs.
   * EventSource can't send Authorization headers, so we accept the JWT
   * as a query parameter and validate it manually.
   */
  @ApiOperation({ summary: 'Stream container logs (SSE)' })
  @Get('containers/:name/stream')
  async streamLogs(
    @Param('name') name: string,
    @Query('token') token: string,
    @Query('tail') tail: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException('Token required');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if ((payload.gmLevel ?? 0) < GmLevel.ADMINISTRATOR) {
      throw new ForbiddenException('Admin access required');
    }

    await this.logsService.streamLogs(
      name,
      tail ? parseInt(tail, 10) : 500,
      res,
    );
  }
}
