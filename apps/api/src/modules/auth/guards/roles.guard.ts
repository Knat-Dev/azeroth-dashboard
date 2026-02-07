import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import { GmLevel } from '../../../common/enums/gm-level.enum.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel = this.reflector.getAllAndOverride<GmLevel>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredLevel === undefined || requiredLevel === null) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || user.gmLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
