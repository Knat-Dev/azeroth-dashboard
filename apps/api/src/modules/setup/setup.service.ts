import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountAccess } from '../../entities/auth/account-access.entity.js';
import { AdminService } from '../admin/admin.service.js';
import { EventService } from '../monitor/event.service.js';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(AccountAccess, 'auth')
    private accountAccessRepo: Repository<AccountAccess>,
    private adminService: AdminService,
    private eventService: EventService,
  ) {}

  async needsSetup(): Promise<boolean> {
    const count = await this.accountAccessRepo
      .createQueryBuilder('aa')
      .where('aa.gmlevel >= :level', { level: 3 })
      .getCount();
    return count === 0;
  }

  async completeSetup(data: {
    username: string;
    password: string;
    email?: string;
    faction?: string;
    baseTheme?: string;
  }) {
    // Double-check: permanently locked if any admin exists
    const setup = await this.needsSetup();
    if (!setup) {
      throw new Error('Setup already completed');
    }

    // Create admin account (expansion=2 for WoTLK, gmLevel=3 for Admin)
    await this.adminService.createAccount(
      data.username,
      data.password,
      data.email,
      2,
      3,
    );

    // Store theme settings
    if (data.faction) {
      this.eventService.setSetting('faction_theme', data.faction);
    }
    if (data.baseTheme) {
      this.eventService.setSetting('base_theme', data.baseTheme);
    }

    this.eventService.logEvent(
      'dashboard',
      'setup_completed',
      `Initial setup completed by ${data.username}`,
    );

    return { success: true };
  }
}
