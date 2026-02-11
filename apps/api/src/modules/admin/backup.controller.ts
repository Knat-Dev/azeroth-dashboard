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
  NotFoundException,
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

  @ApiOperation({ summary: 'List backup sets' })
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

  @ApiOperation({ summary: 'Delete backup schedule' })
  @Delete('schedule')
  async deleteSchedule() {
    await this.backupService.deleteSchedule();
    return { message: 'Schedule deleted' };
  }

  @ApiOperation({ summary: 'Validate a backup set' })
  @Post('sets/:setId/validate')
  validateSet(@Param('setId') setId: string) {
    return this.backupService.validateSet(setId);
  }

  @ApiOperation({ summary: 'Restore a backup set' })
  @Post('sets/:setId/restore')
  restoreSet(@Param('setId') setId: string) {
    return this.backupService.restoreSet(setId);
  }

  @ApiOperation({ summary: 'Get restore operation progress' })
  @Get('restore-operations/:operationId')
  getRestoreProgress(@Param('operationId') operationId: string) {
    const progress = this.backupService.getRestoreProgress(operationId);
    if (!progress) {
      throw new NotFoundException(`Operation "${operationId}" not found`);
    }
    return progress;
  }

  @ApiOperation({ summary: 'Cancel a running restore operation' })
  @Post('restore-operations/:operationId/cancel')
  cancelRestore(@Param('operationId') operationId: string) {
    const cancelled = this.backupService.cancelRestore(operationId);
    if (!cancelled) {
      throw new NotFoundException(`Operation "${operationId}" not found or not running`);
    }
    return { message: 'Cancel requested — restore will stop at next step boundary' };
  }

  @ApiOperation({ summary: 'Delete a backup set' })
  @Delete('sets/:setId')
  deleteSet(@Param('setId') setId: string) {
    return this.backupService.deleteSet(setId);
  }

  @ApiOperation({ summary: 'Download a backup file' })
  @Get('files/:filename')
  async downloadBackup(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.backupService.getBackupPath(filename);
    res.download(filePath, filename);
  }

  @ApiOperation({ summary: 'Delete a backup file' })
  @Delete('files/:filename')
  deleteBackup(@Param('filename') filename: string) {
    return this.backupService.deleteBackup(filename);
  }
}
