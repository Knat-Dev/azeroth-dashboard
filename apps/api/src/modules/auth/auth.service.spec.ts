import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { makeRegistrationData } from './srp6.util';
import {
  createMockRepository,
  createMockAccount,
  createMockAccountAccess,
} from '../../shared/test-utils';

describe('AuthService', () => {
  let service: AuthService;
  let accountRepo: ReturnType<typeof createMockRepository>;
  let accountAccessRepo: ReturnType<typeof createMockRepository>;
  let jwtService: { sign: jest.Mock };

  beforeEach(() => {
    accountRepo = createMockRepository();
    accountAccessRepo = createMockRepository();
    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };

    service = new AuthService(
      accountRepo as any,
      accountAccessRepo as any,
      jwtService as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('should return auth response for valid credentials with GM level 3+', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 3 }));

      const result = await service.login('testuser', 'TESTPASS');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe(1);
      expect(result.user.username).toBe('TESTUSER');
      expect(result.user.gmLevel).toBe(3);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'TESTUSER',
        gmLevel: 3,
      });
    });

    it('should throw UnauthorizedException for unknown username', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.login('unknown', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);

      await expect(service.login('testuser', 'WRONGPASSWORD')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException for GM level 0', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 0 }));

      await expect(service.login('testuser', 'TESTPASS')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for GM level 2 (boundary below 3)', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 2 }));

      await expect(service.login('testuser', 'TESTPASS')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when no AccountAccess row exists', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(null);

      await expect(service.login('testuser', 'TESTPASS')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should be case insensitive (lowercase input matches uppercase DB)', async () => {
      const account = createMockAccount({ username: 'TESTUSER' });
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 3 }));

      const result = await service.login('testuser', 'TESTPASS');

      expect(accountRepo.findOne).toHaveBeenCalledWith({
        where: { username: 'TESTUSER' },
      });
      expect(result.user.username).toBe('TESTUSER');
    });
  });

  describe('refresh', () => {
    it('should return auth response for valid userId', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 4 }));

      const result = await service.refresh(1);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.gmLevel).toBe(4);
    });

    it('should throw UnauthorizedException for unknown userId', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('buildAuthResponse', () => {
    it('should return correct shape with accessToken and user object', async () => {
      const account = createMockAccount();
      accountRepo.findOne.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(createMockAccountAccess({ gmlevel: 3 }));

      const result = await service.login('testuser', 'TESTPASS');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: 1,
        username: 'TESTUSER',
        email: 'TEST@EXAMPLE.COM',
        gmLevel: 3,
      });
    });
  });
});
