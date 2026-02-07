import { SetMetadata } from '@nestjs/common';
import { GmLevel } from '../enums/gm-level.enum.js';

export const ROLES_KEY = 'roles';
export const Roles = (minLevel: GmLevel) =>
  SetMetadata(ROLES_KEY, minLevel);
