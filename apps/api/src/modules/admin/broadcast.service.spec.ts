import { BroadcastService } from './broadcast.service';
import { createMockRepository } from '../../shared/test-utils';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let autobroadcastRepo: ReturnType<typeof createMockRepository>;
  let mockSoapService: { executeCommand: jest.Mock };

  beforeEach(() => {
    autobroadcastRepo = createMockRepository();
    mockSoapService = {
      executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    };

    service = new BroadcastService(
      autobroadcastRepo as any,
      mockSoapService as any,
    );
  });

  describe('sendBroadcast', () => {
    it('should send announce only', async () => {
      const results = await service.sendBroadcast('Hello', 'announce');

      expect(results).toHaveLength(1);
      expect(mockSoapService.executeCommand).toHaveBeenCalledWith('.announce Hello');
    });

    it('should send notify only', async () => {
      const results = await service.sendBroadcast('Hello', 'notify');

      expect(results).toHaveLength(1);
      expect(mockSoapService.executeCommand).toHaveBeenCalledWith('.notify Hello');
    });

    it('should send both announce and notify', async () => {
      const results = await service.sendBroadcast('Hello', 'both');

      expect(results).toHaveLength(2);
      expect(mockSoapService.executeCommand).toHaveBeenCalledTimes(2);
      expect(mockSoapService.executeCommand).toHaveBeenCalledWith('.announce Hello');
      expect(mockSoapService.executeCommand).toHaveBeenCalledWith('.notify Hello');
    });
  });

  describe('CRUD operations', () => {
    it('should list autobroadcasts', async () => {
      const entries = [{ id: 1, text: 'Test', weight: 1, realmid: -1 }];
      autobroadcastRepo.find.mockResolvedValue(entries);

      const result = await service.listAutobroadcasts();

      expect(result).toEqual(entries);
      expect(autobroadcastRepo.find).toHaveBeenCalledWith({
        order: { id: 'ASC' },
      });
    });

    it('should create autobroadcast', async () => {
      autobroadcastRepo.save.mockResolvedValue({
        id: 1,
        text: 'New msg',
        weight: 1,
        realmid: -1,
      });

      const result = await service.createAutobroadcast('New msg');

      expect(autobroadcastRepo.create).toHaveBeenCalledWith({
        text: 'New msg',
        weight: 1,
        realmid: -1,
      });
      expect(autobroadcastRepo.save).toHaveBeenCalled();
    });

    it('should delete autobroadcast', async () => {
      autobroadcastRepo.delete.mockResolvedValue({});

      const result = await service.deleteAutobroadcast(1);

      expect(result).toEqual({ message: 'Autobroadcast deleted' });
      expect(autobroadcastRepo.delete).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe('reloadAutobroadcast', () => {
    it('should call SOAP reload command', async () => {
      await service.reloadAutobroadcast();

      expect(mockSoapService.executeCommand).toHaveBeenCalledWith(
        '.reload autobroadcast',
      );
    });
  });
});
