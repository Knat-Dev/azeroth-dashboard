import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DockerService } from '../docker/docker.service.js';
import { SoapService } from '../admin/soap.service.js';
import { EventService } from './event.service.js';
import { WebhookService } from '../webhook/webhook.service.js';
import { ServerService } from '../server/server.service.js';
import type { ContainerHealth, HealthState } from '@repo/shared';

export type { ContainerHealth, HealthState };

const POLL_INTERVAL_MS = 5000;
const SOAP_TIMEOUT_MS = parseInt(process.env.SOAP_TIMEOUT_MS ?? '5000', 10);
const PLAYER_RECORD_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const CONTAINERS = ['ac-worldserver', 'ac-authserver'] as const;
type ContainerName = (typeof CONTAINERS)[number];

interface ContainerTracker {
  previousState: string;
  crashLoopActive: boolean;
  crashedAt: number | null; // timestamp when crash detected
  restartInProgress: boolean;
  soapFailCount: number; // consecutive SOAP failures (worldserver only)
}

@Injectable()
export class MonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorService.name);
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private playerRecordHandle: ReturnType<typeof setInterval> | null = null;
  private pruneHandle: ReturnType<typeof setInterval> | null = null;

  // Config (env defaults, overridden by SQLite settings)
  private autoRestartEnabled: boolean;
  private cooldownMs: number;
  private maxRetries: number;
  private retryIntervalMs: number;
  private crashLoopThreshold: number;
  private crashLoopWindowMs: number;

  private trackers: Record<ContainerName, ContainerTracker> = {
    'ac-worldserver': {
      previousState: 'unknown',
      crashLoopActive: false,
      crashedAt: null,
      restartInProgress: false,
      soapFailCount: 0,
    },
    'ac-authserver': {
      previousState: 'unknown',
      crashLoopActive: false,
      crashedAt: null,
      restartInProgress: false,
      soapFailCount: 0,
    },
  };

  private cachedHealth: HealthState = {
    worldserver: { state: 'unknown', status: '' },
    authserver: { state: 'unknown', status: '' },
    soap: { connected: false, degraded: false },
    players: { online: 0 },
    lastUpdated: new Date().toISOString(),
  };

  constructor(
    private dockerService: DockerService,
    @Inject(forwardRef(() => SoapService))
    private soapService: SoapService,
    private eventService: EventService,
    @Inject(forwardRef(() => WebhookService))
    private webhookService: WebhookService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ServerService))
    private serverService: ServerService,
  ) {
    // Load defaults from env
    this.autoRestartEnabled =
      (configService.get('AUTO_RESTART_ENABLED') ?? 'true') === 'true';
    this.cooldownMs =
      parseInt(configService.get('AUTO_RESTART_COOLDOWN') ?? '10000', 10);
    this.maxRetries =
      parseInt(configService.get('AUTO_RESTART_MAX_RETRIES') ?? '3', 10);
    this.retryIntervalMs =
      parseInt(configService.get('AUTO_RESTART_RETRY_INTERVAL') ?? '15000', 10);
    this.crashLoopThreshold =
      parseInt(configService.get('CRASH_LOOP_THRESHOLD') ?? '3', 10);
    this.crashLoopWindowMs =
      parseInt(configService.get('CRASH_LOOP_WINDOW') ?? '300000', 10); // 5 min
  }

  onModuleInit() {
    this.loadSettingsOverrides();
    this.logger.log(
      `Health monitor started (poll: ${POLL_INTERVAL_MS / 1000}s, auto-restart: ${this.autoRestartEnabled})`,
    );
    void this.poll();
    this.pollHandle = setInterval(() => void this.poll(), POLL_INTERVAL_MS);

    // Record player count every 5 minutes
    this.playerRecordHandle = setInterval(() => {
      this.eventService.recordPlayerCount(
        this.cachedHealth.players.online,
      );
    }, PLAYER_RECORD_INTERVAL_MS);

    // Prune old data daily
    this.pruneHandle = setInterval(() => {
      this.eventService.prunePlayerHistory();
    }, PRUNE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (this.playerRecordHandle) clearInterval(this.playerRecordHandle);
    if (this.pruneHandle) clearInterval(this.pruneHandle);
    this.logger.log('Health monitor stopped');
  }

  getHealth(): HealthState {
    return this.cachedHealth;
  }

  /** Reload all runtime settings (called from admin settings save) */
  reloadAllSettings(): void {
    this.loadSettingsOverrides();
    this.webhookService.reloadConfig();
  }

  /** Reload config from SQLite settings (called on settings change) */
  loadSettingsOverrides(): void {
    const settings = this.eventService.getAllSettings();
    if (settings['autoRestartEnabled'] !== undefined) {
      this.autoRestartEnabled = settings['autoRestartEnabled'] === 'true';
    }
    if (settings['autoRestartCooldown']) {
      this.cooldownMs = parseInt(settings['autoRestartCooldown'], 10);
    }
    if (settings['autoRestartMaxRetries']) {
      this.maxRetries = parseInt(settings['autoRestartMaxRetries'], 10);
    }
    if (settings['autoRestartRetryInterval']) {
      this.retryIntervalMs = parseInt(
        settings['autoRestartRetryInterval'],
        10,
      );
    }
    if (settings['crashLoopThreshold']) {
      this.crashLoopThreshold = parseInt(
        settings['crashLoopThreshold'],
        10,
      );
    }
    if (settings['crashLoopWindow']) {
      this.crashLoopWindowMs = parseInt(settings['crashLoopWindow'], 10);
    }
  }

  /** Clear crash loop state for a container (called on manual restart) */
  clearCrashLoop(container: string): void {
    const tracker = this.trackers[container as ContainerName];
    if (tracker) {
      tracker.crashLoopActive = false;
      tracker.crashedAt = null;
      this.logger.log(`Crash loop cleared for ${container}`);
      this.eventService.logEvent(
        container,
        'crash_loop_cleared',
        'Manually cleared by admin',
      );
    }
  }

  private async poll(): Promise<void> {
    try {
      const [worldState, authState, soapOk, onlineCount] =
        await Promise.all([
          this.dockerService.getContainerState('ac-worldserver'),
          this.dockerService.getContainerState('ac-authserver'),
          this.checkSoap(),
          this.serverService.getOnlineCount(),
        ]);

      // Process state changes
      this.processStateChange('ac-worldserver', worldState.state);
      this.processStateChange('ac-authserver', authState.state);
      this.processSoapHealth(soapOk);

      // Fetch realm name
      let realmName: string | undefined;
      try {
        realmName = await this.serverService.getRealmName();
      } catch {
        // ignore
      }

      // Update cached health
      this.cachedHealth = {
        worldserver: {
          state: worldState.state,
          status: worldState.status,
          crashLoop: this.trackers['ac-worldserver'].crashLoopActive,
        },
        authserver: {
          state: authState.state,
          status: authState.status,
          crashLoop: this.trackers['ac-authserver'].crashLoopActive,
        },
        soap: {
          connected: soapOk,
          degraded: this.trackers['ac-worldserver'].soapFailCount >= 3,
        },
        players: { online: onlineCount },
        lastUpdated: new Date().toISOString(),
        uptime: this.lastSoapUptime || undefined,
        realmName,
      };
    } catch (err) {
      this.logger.error(`Health poll failed: ${err}`);
    }
  }

  private processStateChange(
    container: ContainerName,
    currentState: string,
  ): void {
    const tracker = this.trackers[container];
    const prev = tracker.previousState;

    if (prev === 'unknown') {
      tracker.previousState = currentState;
      return;
    }

    if (prev === currentState) return;

    // State changed
    this.logger.log(`${container}: ${prev} -> ${currentState}`);

    // running -> exited/dead = crash
    if (
      prev === 'running' &&
      ['exited', 'dead'].includes(currentState)
    ) {
      tracker.crashedAt = Date.now();
      this.eventService.logEvent(container, 'crash', `State: ${prev} -> ${currentState}`);
      this.webhookService.sendNotification(
        'crash',
        'high',
        `${container} crashed`,
        `State changed from ${prev} to ${currentState}`,
      );
      this.logger.warn(`${container} crashed`);

      // Trigger auto-restart
      if (
        this.autoRestartEnabled &&
        !tracker.crashLoopActive &&
        !tracker.restartInProgress
      ) {
        void this.autoRestart(container);
      }
    }

    // exited/dead -> running = recovery
    if (
      ['exited', 'dead'].includes(prev) &&
      currentState === 'running'
    ) {
      const downtime = tracker.crashedAt
        ? Date.now() - tracker.crashedAt
        : undefined;
      this.eventService.logEvent(
        container,
        'recovery',
        `Container recovered`,
        downtime,
      );
      tracker.crashedAt = null;
      this.logger.log(
        `${container} recovered${downtime ? ` (downtime: ${Math.round(downtime / 1000)}s)` : ''}`,
      );
    }

    tracker.previousState = currentState;
  }

  private async autoRestart(container: ContainerName): Promise<void> {
    const tracker = this.trackers[container];
    tracker.restartInProgress = true;

    // 2.6: Dependency check — don't restart worldserver if authserver is down
    if (container === 'ac-worldserver') {
      const authTracker = this.trackers['ac-authserver'];
      if (
        authTracker.previousState !== 'running' &&
        authTracker.previousState !== 'unknown'
      ) {
        this.logger.warn(
          `Skipping worldserver auto-restart: authserver is ${authTracker.previousState}`,
        );
        this.eventService.logEvent(
          container,
          'restart_skipped',
          'Dependency not met: authserver is not running',
        );
        tracker.restartInProgress = false;
        return;
      }
    }

    // Wait cooldown
    this.logger.log(
      `Auto-restart: waiting ${this.cooldownMs / 1000}s cooldown for ${container}`,
    );
    await this.sleep(this.cooldownMs);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      this.logger.log(
        `Auto-restart: attempt ${attempt}/${this.maxRetries} for ${container}`,
      );
      this.eventService.logEvent(
        container,
        'restart_attempt',
        `Attempt ${attempt}/${this.maxRetries}`,
      );

      try {
        await this.dockerService.restartContainer(container);

        // Wait a moment for container to settle
        await this.sleep(3000);

        const state = await this.dockerService.getContainerState(container);
        if (state.state === 'running') {
          this.logger.log(`Auto-restart: ${container} recovered on attempt ${attempt}`);
          this.eventService.logEvent(
            container,
            'restart_success',
            `Recovered on attempt ${attempt}`,
            tracker.crashedAt ? Date.now() - tracker.crashedAt : undefined,
          );

          // 2.5: Check crash loop
          this.checkCrashLoop(container);

          tracker.restartInProgress = false;
          return;
        }
      } catch (err) {
        this.logger.error(
          `Auto-restart: attempt ${attempt} failed for ${container}: ${err}`,
        );
      }

      if (attempt < this.maxRetries) {
        await this.sleep(this.retryIntervalMs);
      }
    }

    // All retries exhausted
    this.logger.error(
      `Auto-restart: all ${this.maxRetries} attempts failed for ${container}`,
    );
    this.eventService.logEvent(
      container,
      'restart_failed',
      `All ${this.maxRetries} attempts exhausted`,
    );
    this.webhookService.sendNotification(
      'restart_failed',
      'critical',
      `${container} restart failed`,
      `All ${this.maxRetries} auto-restart attempts exhausted. Manual intervention required.`,
    );
    tracker.restartInProgress = false;
  }

  private checkCrashLoop(container: ContainerName): void {
    const windowStart = new Date(
      Date.now() - this.crashLoopWindowMs,
    ).toISOString();
    const restartCount = this.eventService.countEventsSince(
      windowStart,
      container,
      'restart_success',
    );
    const crashCount = this.eventService.countEventsSince(
      windowStart,
      container,
      'crash',
    );

    if (
      restartCount >= this.crashLoopThreshold ||
      crashCount >= this.crashLoopThreshold
    ) {
      const tracker = this.trackers[container];
      tracker.crashLoopActive = true;
      this.logger.error(
        `CRASH LOOP detected for ${container}: ${crashCount} crashes, ${restartCount} restarts in ${this.crashLoopWindowMs / 1000}s window`,
      );
      this.eventService.logEvent(
        container,
        'crash_loop',
        `${crashCount} crashes in ${this.crashLoopWindowMs / 1000}s — auto-restart suspended`,
      );
      this.webhookService.sendNotification(
        'crash_loop',
        'critical',
        `CRASH LOOP: ${container}`,
        `${crashCount} crashes in ${this.crashLoopWindowMs / 1000}s. Auto-restart suspended. Manual intervention required.`,
      );
    }
  }

  private processSoapHealth(connected: boolean): void {
    const tracker = this.trackers['ac-worldserver'];
    if (connected) {
      if (tracker.soapFailCount >= 3) {
        this.logger.log('SOAP recovered from degraded state');
        this.eventService.logEvent(
          'ac-worldserver',
          'soap_recovered',
          'SOAP interface recovered',
        );
      }
      tracker.soapFailCount = 0;
    } else {
      tracker.soapFailCount++;
      if (tracker.soapFailCount === 3) {
        this.logger.warn(
          'SOAP degraded: 3 consecutive check failures (container is running)',
        );
        this.eventService.logEvent(
          'ac-worldserver',
          'soap_degraded',
          'SOAP interface failed 3 consecutive checks',
        );
      }
    }
  }

  private lastSoapUptime: string = '';

  private async checkSoap(): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('SOAP timeout')),
          SOAP_TIMEOUT_MS,
        ),
      );
      const soapPromise = this.soapService.executeCommand('.server info');
      const result = await Promise.race([soapPromise, timeoutPromise]);
      if (result.success && result.message) {
        // Parse uptime from .server info response
        // e.g. "AzerothCore ... Uptime: 1 Day(s) 3 Hour(s) 25 Minute(s) 10 Second(s)"
        const uptimeMatch = result.message.match(
          /Uptime:\s*(.+?)(?:\.|$)/i,
        );
        if (uptimeMatch) {
          this.lastSoapUptime = uptimeMatch[1].trim();
        }
      }
      return result.success;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
