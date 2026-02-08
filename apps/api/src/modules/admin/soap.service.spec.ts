import { SoapService } from './soap.service';
import { ConfigService } from '@nestjs/config';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SoapService', () => {
  let service: SoapService;

  beforeEach(() => {
    jest.clearAllMocks();
    const configService = {
      get: jest.fn((key: string, defaultVal: any) => defaultVal),
    } as unknown as ConfigService;
    service = new SoapService(configService);
  });

  describe('executeCommand', () => {
    it('should send SOAP envelope and return success', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: '<result>Server uptime: 1 day</result>',
      });

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Server uptime: 1 day');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:7878/',
        expect.stringContaining('.server info'),
        expect.objectContaining({
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
          auth: { username: 'admin', password: 'admin' },
        }),
      );
    });

    it('should escape XML special characters in commands', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: '<result>done</result>',
      });

      await service.executeCommand('.announce <Hello> & "World"');

      const sentBody = mockedAxios.post.mock.calls[0][1] as string;
      expect(sentBody).toContain('&lt;Hello&gt;');
      expect(sentBody).toContain('&amp;');
      expect(sentBody).toContain('&quot;World&quot;');
    });

    it('should handle SOAP fault response', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: '<faultstring>Command failed: unknown command</faultstring>',
        },
      });
      // patch isAxiosError
      (mockedAxios as any).isAxiosError = jest.fn(() => true);

      const result = await service.executeCommand('.invalidcommand');

      expect(result.success).toBe(false);
      expect(result.message).toContain('unknown command');
    });

    it('should handle connection errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      (mockedAxios as any).isAxiosError = jest.fn(() => false);

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });

    it('should escape apostrophe in XML', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: '<result>done</result>',
      });

      await service.executeCommand("it's a test");

      const sentBody = mockedAxios.post.mock.calls[0][1] as string;
      expect(sentBody).toContain('&apos;');
      expect(sentBody).not.toContain("it's");
    });

    it('should handle response with no result tag', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: 'plain text response',
      });

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(true);
      expect(result.message).toBe('plain text response');
    });

    it('should clean carriage return and newline entities in result', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: '<result>line1&#xD;&#xA;line2</result>',
      });

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(true);
      expect(result.message).toBe('line1\nline2');
    });

    it('should return unknown error when fault has no faultstring', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: '<soap:Fault><detail>some error</detail></soap:Fault>',
        },
      });
      (mockedAxios as any).isAxiosError = jest.fn(() => true);

      const result = await service.executeCommand('.test');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown SOAP error');
    });

    it('should handle timeout errors as connection errors', async () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      mockedAxios.post.mockRejectedValueOnce(timeoutError);
      (mockedAxios as any).isAxiosError = jest.fn(() => false);

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to connect');
    });

    it('should handle result tag with attributes', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: '<result xmlns="urn:AC">Server online</result>',
      });

      const result = await service.executeCommand('.server info');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Server online');
    });
  });
});
