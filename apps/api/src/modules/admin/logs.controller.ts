import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class LogsController {
  constructor(private logsService: LogsService) {}

  @Get()
  queryLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('level') level?: string,
    @Query('type') type?: string,
  ) {
    return this.logsService.queryLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      level: level ? parseInt(level, 10) : undefined,
      type,
    });
  }

  @Get('ip-actions')
  queryIpActions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('accountId') accountId?: string,
    @Query('ip') ip?: string,
  ) {
    return this.logsService.queryIpActions({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      accountId: accountId ? parseInt(accountId, 10) : undefined,
      ip,
    });
  }

  @Get('files')
  readLogFile(
    @Query('file') file: string,
    @Query('lines') lines?: string,
  ) {
    return this.logsService.readLogFile(
      file ?? 'Server.log',
      lines ? parseInt(lines, 10) : 200,
    );
  }
}
