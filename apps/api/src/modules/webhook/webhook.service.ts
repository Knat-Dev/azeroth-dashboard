import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EventService } from '../monitor/event.service.js';

type Severity = 'info' | 'warning' | 'high' | 'critical';

const SEVERITY_COLORS: Record<Severity, number> = {
  info: 0x3b82f6, // blue
  warning: 0xeab308, // yellow
  high: 0xef4444, // red
  critical: 0x7f1d1d, // dark red
};

const RATE_LIMIT_MS = 60_000; // 1 webhook per event type per 60s

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private discordUrl: string | null;
  private enabledEvents: Set<string>;
  private lastSent: Map<string, number> = new Map();

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => EventService))
    private eventService: EventService,
  ) {
    this.discordUrl = configService.get<string>('DISCORD_WEBHOOK_URL') || null;
    const events =
      configService.get<string>('WEBHOOK_EVENTS') ||
      'crash,restart_failed,crash_loop,backup_success,backup_failed';
    this.enabledEvents = new Set(events.split(',').map((e) => e.trim()));
  }

  /** Reload config from settings */
  reloadConfig(): void {
    const url = this.eventService.getSetting('discordWebhookUrl');
    if (url !== null) this.discordUrl = url || null;

    const events = this.eventService.getSetting('webhookEvents');
    if (events !== null) {
      this.enabledEvents = new Set(events.split(',').map((e) => e.trim()));
    }
  }

  /** Fire-and-forget notification */
  sendNotification(
    eventType: string,
    severity: Severity,
    title: string,
    details?: string,
  ): void {
    if (!this.discordUrl) return;
    if (!this.enabledEvents.has(eventType)) return;

    // Rate limit
    const now = Date.now();
    const lastTime = this.lastSent.get(eventType) ?? 0;
    if (now - lastTime < RATE_LIMIT_MS) return;
    this.lastSent.set(eventType, now);

    // Fire and forget
    void this.send(eventType, severity, title, details);
  }

  /** Send a test notification (bypasses rate limit and event filter) */
  async sendTestNotification(): Promise<{ success: boolean; message: string }> {
    if (!this.discordUrl) {
      return { success: false, message: 'No webhook URL configured' };
    }
    try {
      await this.send(
        'test',
        'info',
        'Test Notification',
        'This is a test notification from Azeroth Dashboard.',
      );
      return { success: true, message: 'Test notification sent' };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async send(
    eventType: string,
    severity: Severity,
    title: string,
    details?: string,
  ): Promise<void> {
    if (!this.discordUrl) return;

    try {
      await axios.post(this.discordUrl, {
        embeds: [
          {
            title,
            description: details || undefined,
            color: SEVERITY_COLORS[severity],
            timestamp: new Date().toISOString(),
            footer: { text: `Azeroth Dashboard • ${eventType}` },
            fields: [
              {
                name: 'Severity',
                value: severity.toUpperCase(),
                inline: true,
              },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.warn(
        `Webhook delivery failed for ${eventType}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
