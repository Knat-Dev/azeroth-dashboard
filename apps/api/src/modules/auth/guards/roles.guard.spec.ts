import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  function createMockContext(user?: { gmLevel: number }) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as any;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow access when no @Roles decorator is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('should allow access when required level is 3 and user has exactly 3', () => {
    reflector.getAllAndOverride.mockReturnValue(3);
    expect(guard.canActivate(createMockContext({ gmLevel: 3 }))).toBe(true);
  });

  it('should allow access when required level is 3 and user has 4', () => {
    reflector.getAllAndOverride.mockReturnValue(3);
    expect(guard.canActivate(createMockContext({ gmLevel: 4 }))).toBe(true);
  });

  it('should throw ForbiddenException when required level is 3 and user has 2', () => {
    reflector.getAllAndOverride.mockReturnValue(3);
    expect(() => guard.canActivate(createMockContext({ gmLevel: 2 }))).toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException when no user on request', () => {
    reflector.getAllAndOverride.mockReturnValue(3);
    expect(() => guard.canActivate(createMockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('should allow access when required level is 0 and user has gmLevel 0', () => {
    reflector.getAllAndOverride.mockReturnValue(0);
    expect(guard.canActivate(createMockContext({ gmLevel: 0 }))).toBe(true);
  });

  it('should allow access when decorator returns null', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });
});
