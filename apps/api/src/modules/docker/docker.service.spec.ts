import { BadRequestException } from '@nestjs/common';
import { DockerService } from './docker.service';

// Mock http module
jest.mock('http', () => {
  const mockRequest = jest.fn();
  return { request: mockRequest };
});
import * as http from 'http';

describe('DockerService', () => {
  let service: DockerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DockerService();
  });

  describe('validateContainer', () => {
    it('should allow valid container names', () => {
      expect(service.isAllowedContainer('ac-worldserver')).toBe(true);
      expect(service.isAllowedContainer('ac-authserver')).toBe(true);
    });

    it('should reject disallowed container names', () => {
      expect(service.isAllowedContainer('evil-container')).toBe(false);
    });
  });

  describe('stripMultiplexedHeaders', () => {
    it('should strip stdout frame headers', () => {
      // Build a multiplexed frame: type=1(stdout), padding=0,0,0, size=5(big-endian), payload="hello"
      const header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 5]);
      const payload = Buffer.from('hello');
      const buf = Buffer.concat([header, payload]);

      expect(service.stripMultiplexedHeaders(buf)).toBe('hello');
    });

    it('should strip stderr frame headers', () => {
      const header = Buffer.from([2, 0, 0, 0, 0, 0, 0, 5]);
      const payload = Buffer.from('error');
      const buf = Buffer.concat([header, payload]);

      expect(service.stripMultiplexedHeaders(buf)).toBe('error');
    });

    it('should handle multi-frame buffers', () => {
      const frame1Header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 5]);
      const frame1Payload = Buffer.from('hello');
      const frame2Header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 6]);
      const frame2Payload = Buffer.from(' world');
      const buf = Buffer.concat([
        frame1Header,
        frame1Payload,
        frame2Header,
        frame2Payload,
      ]);

      expect(service.stripMultiplexedHeaders(buf)).toBe('hello world');
    });

    it('should pass through short buffers (< 8 bytes)', () => {
      const buf = Buffer.from('short');
      expect(service.stripMultiplexedHeaders(buf)).toBe('short');
    });

    it('should pass through TTY (non-multiplexed) output', () => {
      // TTY output doesn't start with 0x00, 0x01, or 0x02 in position 0
      const buf = Buffer.from('This is TTY output\nWith multiple lines\n');
      expect(service.stripMultiplexedHeaders(buf)).toBe(
        'This is TTY output\nWith multiple lines\n',
      );
    });

    it('should handle truncated frame gracefully', () => {
      // Valid first frame but the buffer ends before the second frame's payload
      const frame1Header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 5]);
      const frame1Payload = Buffer.from('hello');
      const frame2Header = Buffer.from([1, 0, 0, 0, 0, 0, 0, 20]); // claims 20 bytes but only 3 available
      const partial = Buffer.from('abc');
      const buf = Buffer.concat([
        frame1Header,
        frame1Payload,
        frame2Header,
        partial,
      ]);

      // Should extract frame1 and stop at truncated frame2
      expect(service.stripMultiplexedHeaders(buf)).toBe('hello');
    });
  });

  describe('listContainers', () => {
    it('should filter to allowed containers only', async () => {
      const mockReq = {
        on: jest.fn(),
        end: jest.fn(),
      };

      (http.request as jest.Mock).mockImplementation((_opts: any, cb: any) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event: string, handler: any) => {
            if (event === 'data') {
              handler(
                Buffer.from(
                  JSON.stringify([
                    {
                      Id: '1',
                      Names: ['/ac-worldserver'],
                      State: 'running',
                      Status: 'Up',
                      Image: 'test',
                    },
                    {
                      Id: '2',
                      Names: ['/ac-authserver'],
                      State: 'running',
                      Status: 'Up',
                      Image: 'test',
                    },
                    {
                      Id: '3',
                      Names: ['/evil-container'],
                      State: 'running',
                      Status: 'Up',
                      Image: 'test',
                    },
                  ]),
                ),
              );
            }
            if (event === 'end') {
              handler();
            }
          }),
        };
        cb(mockRes);
        return mockReq;
      });

      const result = await service.listContainers();

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.name)).toEqual([
        'ac-worldserver',
        'ac-authserver',
      ]);
    });
  });

  describe('inspectContainer', () => {
    it('should reject non-allowed container', async () => {
      await expect(service.inspectContainer('evil-container')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return container details for allowed container', async () => {
      const mockReq = { on: jest.fn(), end: jest.fn() };

      (http.request as jest.Mock).mockImplementation((_opts: any, cb: any) => {
        const mockRes = {
          statusCode: 200,
          on: jest.fn((event: string, handler: any) => {
            if (event === 'data') {
              handler(
                Buffer.from(
                  JSON.stringify({
                    Config: { Tty: true },
                    State: {
                      Status: 'running',
                      StartedAt: '2024-01-01T00:00:00Z',
                    },
                    Status: 'Up 1 hour',
                  }),
                ),
              );
            }
            if (event === 'end') handler();
          }),
        };
        cb(mockRes);
        return mockReq;
      });

      const result = await service.inspectContainer('ac-worldserver');

      expect(result.tty).toBe(true);
      expect(result.state).toBe('running');
      expect(result.startedAt).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('restartContainer', () => {
    it('should reject non-allowed container', async () => {
      await expect(service.restartContainer('evil-container')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
