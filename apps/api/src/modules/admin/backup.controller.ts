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
import type { Response } from 'express';
import { BackupService } from './backup.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../common/enums/gm-level.enum.js';

@Controller('admin/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GmLevel.ADMINISTRATOR)
export class BackupController {
  constructor(private backupService: BackupService) {}

  @Post()
  triggerBackup(@Body() body: { databases: string[] }) {
    return this.backupService.triggerBackup(body.databases);
  }

  @Get()
  listBackups() {
    return this.backupService.listBackups();
  }

  @Get('schedule')
  getSchedule() {
    return this.backupService.getSchedule();
  }

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

  @Get(':filename')
  async downloadBackup(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.backupService.getBackupPath(filename);
    res.download(filePath, filename);
  }

  @Delete(':filename')
  deleteBackup(@Param('filename') filename: string) {
    return this.backupService.deleteBackup(filename);
  }
}
