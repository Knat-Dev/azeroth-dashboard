import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { BackupService } from './backup.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@ApiTags('Backups')
@ApiBearerAuth()
@Controller('admin/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class BackupController {
  constructor(private backupService: BackupService) {}

  @ApiOperation({ summary: 'Trigger a database backup' })
  @Post()
  triggerBackup(@Body() body: { databases: string[] }) {
    return this.backupService.triggerBackup(body.databases);
  }

  @ApiOperation({ summary: 'List backups' })
  @Get()
  listBackups() {
    return this.backupService.listBackups();
  }

  @ApiOperation({ summary: 'Get backup schedule' })
  @Get('schedule')
  getSchedule() {
    return this.backupService.getSchedule();
  }

  @ApiOperation({ summary: 'Set backup schedule' })
  @Put('schedule')
  setSchedule(
    @Body()
    body: {
      enabled: boolean;
      cron: string;
      databases: string[];
      retentionDays: number;
    },
  ) {
    return this.backupService.setSchedule(body);
  }

  @ApiOperation({ summary: 'Download a backup file' })
  @Get(':filename')
  async downloadBackup(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.backupService.getBackupPath(filename);
    res.download(filePath, filename);
  }

  @ApiOperation({ summary: 'Delete a backup' })
  @Delete(':filename')
  deleteBackup(@Param('filename') filename: string) {
    return this.backupService.deleteBackup(filename);
  }
}
