import { LogsService } from './logs.service';

describe('LogsService', () => {
  let service: LogsService;
  let mockDockerService: {
    isAllowedContainer: jest.Mock;
    dockerRequest: jest.Mock;
    stripMultiplexedHeaders: jest.Mock;
    listContainers: jest.Mock;
  };

  beforeEach(() => {
    mockDockerService = {
      isAllowedContainer: jest.fn(),
      dockerRequest: jest.fn(),
      stripMultiplexedHeaders: jest.fn(),
      listContainers: jest.fn(),
    };

    service = new LogsService(mockDockerService as any);
  });

  describe('getContainerLogs', () => {
    it('should return logs for allowed container', async () => {
      mockDockerService.isAllowedContainer.mockReturnValue(true);
      mockDockerService.dockerRequest.mockResolvedValue(Buffer.from('log output'));
      mockDockerService.stripMultiplexedHeaders.mockReturnValue('log output');

      const result = await service.getContainerLogs('ac-worldserver');

      expect(result.logs).toBe('log output');
      expect(result.error).toBeUndefined();
    });

    it('should return error for disallowed container', async () => {
      mockDockerService.isAllowedContainer.mockReturnValue(false);

      const result = await service.getContainerLogs('evil-container');

      expect(result.logs).toBe('');
      expect(result.error).toBe('Container not allowed');
    });

    it('should handle docker failure gracefully', async () => {
      mockDockerService.isAllowedContainer.mockReturnValue(true);
      mockDockerService.dockerRequest.mockRejectedValue(new Error('Docker socket error'));

      const result = await service.getContainerLogs('ac-worldserver');

      expect(result.logs).toBe('');
      expect(result.error).toContain('Failed to fetch logs');
    });
  });

  describe('listContainers', () => {
    it('should delegate to dockerService', async () => {
      const containers = [
        { name: 'ac-worldserver', state: 'running', status: 'Up', image: 'test' },
      ];
      mockDockerService.listContainers.mockResolvedValue(containers);

      const result = await service.listContainers();

      expect(result).toEqual(containers);
    });
  });
});
