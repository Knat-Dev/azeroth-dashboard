jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { WebhookService } from './webhook.service';
import { createMockConfigService } from '../../shared/test-utils';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockEventService: { getSetting: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventService = {
      getSetting: jest.fn().mockReturnValue(null),
    };

    const configService = createMockConfigService({
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/test',
      WEBHOOK_EVENTS: 'crash,restart_failed,crash_loop,backup_success,backup_failed',
    });

    service = new WebhookService(configService as any, mockEventService as any);
  });

  describe('sendNotification', () => {
    it('should send notification for enabled event type', async () => {
      mockedAxios.post.mockResolvedValue({ status: 204 });

      service.sendNotification('crash', 'high', 'Server crashed', 'Details here');

      // Give fire-and-forget a tick to execute
      await new Promise((r) => setTimeout(r, 10));

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: 'Server crashed',
              description: 'Details here',
            }),
          ]),
        }),
      );
    });

    it('should not send when no URL configured', () => {
      const configService = createMockConfigService({
        DISCORD_WEBHOOK_URL: '',
        WEBHOOK_EVENTS: 'crash',
      });
      const svc = new WebhookService(configService as any, mockEventService as any);

      svc.sendNotification('crash', 'high', 'Test', 'Details');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should not send for disabled event type', () => {
      service.sendNotification('unknown_event', 'info', 'Test', 'Details');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should skip same event type within 60s', async () => {
      mockedAxios.post.mockResolvedValue({ status: 204 });

      service.sendNotification('crash', 'high', 'First crash');
      service.sendNotification('crash', 'high', 'Second crash');

      await new Promise((r) => setTimeout(r, 10));

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should allow different event types independently', async () => {
      mockedAxios.post.mockResolvedValue({ status: 204 });

      service.sendNotification('crash', 'high', 'Crash');
      service.sendNotification('backup_success', 'info', 'Backup');

      await new Promise((r) => setTimeout(r, 10));

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should allow same event type after rate limit expires', async () => {
      mockedAxios.post.mockResolvedValue({ status: 204 });

      // Manually set lastSent to past
      (service as any).lastSent.set('crash', Date.now() - 61_000);

      service.sendNotification('crash', 'high', 'After expiry');

      await new Promise((r) => setTimeout(r, 10));

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should not throw when axios fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      service.sendNotification('crash', 'high', 'Test');

      // Should not throw
      await new Promise((r) => setTimeout(r, 10));
    });
  });

  describe('reloadConfig', () => {
    it('should update URL and events from settings', () => {
      mockEventService.getSetting
        .mockReturnValueOnce('https://new-url.com/hook') // discordWebhookUrl
        .mockReturnValueOnce('crash,backup_success'); // webhookEvents

      service.reloadConfig();

      expect((service as any).discordUrl).toBe('https://new-url.com/hook');
      expect((service as any).enabledEvents.has('crash')).toBe(true);
      expect((service as any).enabledEvents.has('backup_success')).toBe(true);
      expect((service as any).enabledEvents.has('restart_failed')).toBe(false);
    });
  });
});
