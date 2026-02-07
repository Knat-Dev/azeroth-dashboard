import { BadRequestException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import {
  createMockRepository,
  createMockAccount,
  createMockAccountAccess,
} from '../../shared/test-utils';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepo: ReturnType<typeof createMockRepository>;
  let accountAccessRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    accountRepo = createMockRepository();
    accountAccessRepo = createMockRepository();

    service = new AccountsService(
      accountRepo as any,
      accountAccessRepo as any,
    );
  });

  describe('getProfile', () => {
    it('should return profile with gm level', async () => {
      const account = createMockAccount();
      accountRepo.findOneByOrFail.mockResolvedValue(account);
      accountAccessRepo.findOne.mockResolvedValue(
        createMockAccountAccess({ gmlevel: 3 }),
      );

      const result = await service.getProfile(1);

      expect(result.id).toBe(1);
      expect(result.username).toBe('TESTUSER');
      expect(result.gmLevel).toBe(3);
    });

    it('should default gmLevel to 0 when no access record', async () => {
      accountRepo.findOneByOrFail.mockResolvedValue(createMockAccount());
      accountAccessRepo.findOne.mockResolvedValue(null);

      const result = await service.getProfile(1);

      expect(result.gmLevel).toBe(0);
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      const account = createMockAccount();
      accountRepo.findOneByOrFail.mockResolvedValue(account);
      accountRepo.update.mockResolvedValue({});

      const result = await service.changePassword(1, 'TESTPASS', 'NEWPASS');

      expect(result.message).toBe('Password changed successfully');
      expect(accountRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          salt: expect.any(Buffer),
          verifier: expect.any(Buffer),
        }),
      );
    });

    it('should throw BadRequestException for wrong current password', async () => {
      const account = createMockAccount();
      accountRepo.findOneByOrFail.mockResolvedValue(account);

      await expect(
        service.changePassword(1, 'WRONGPASS', 'NEWPASS'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for password too long (>16)', async () => {
      await expect(
        service.changePassword(1, 'current', 'a'.repeat(17)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changeEmail', () => {
    it('should update email uppercased', async () => {
      accountRepo.update.mockResolvedValue({});

      const result = await service.changeEmail(1, 'new@email.com');

      expect(result.message).toBe('Email changed successfully');
      expect(accountRepo.update).toHaveBeenCalledWith(1, {
        email: 'NEW@EMAIL.COM',
      });
    });

    it('should throw BadRequestException for email too long', async () => {
      await expect(
        service.changeEmail(1, 'a'.repeat(256)),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
