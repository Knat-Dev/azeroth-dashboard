import { MonitorService } from './monitor.service';
import { createMockRepository, createMockConfigService } from '../../shared/test-utils';

describe('MonitorService', () => {
  let service: MonitorService;
  let mockDockerService: any;
  let mockSoapService: any;
  let mockEventService: any;
  let mockWebhookService: any;
  let mockCharacterRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    jest.useFakeTimers();

    mockDockerService = {
      getContainerState: jest.fn().mockResolvedValue({ state: 'running', status: 'Up 1 hour', startedAt: null }),
      restartContainer: jest.fn().mockResolvedValue({ state: 'running', status: 'Up', startedAt: null }),
    };

    mockSoapService = {
      executeCommand: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    };

    mockEventService = {
      logEvent: jest.fn(),
      countEventsSince: jest.fn().mockReturnValue(0),
      getAllSettings: jest.fn().mockReturnValue({}),
      recordPlayerCount: jest.fn(),
      prunePlayerHistory: jest.fn(),
    };

    mockWebhookService = {
      sendNotification: jest.fn(),
      reloadConfig: jest.fn(),
    };

    mockCharacterRepo = createMockRepository();
    mockCharacterRepo.count.mockResolvedValue(0);

    const configService = createMockConfigService({
      AUTO_RESTART_ENABLED: 'true',
      AUTO_RESTART_COOLDOWN: '100',
      AUTO_RESTART_MAX_RETRIES: '3',
      AUTO_RESTART_RETRY_INTERVAL: '100',
      CRASH_LOOP_THRESHOLD: '3',
      CRASH_LOOP_WINDOW: '300000',
    });

    service = new MonitorService(
      mockDockerService,
      mockSoapService,
      mockEventService,
      mockWebhookService,
      configService as any,
      mockCharacterRepo as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('processStateChange', () => {
    const processStateChange = (container: string, state: string) =>
      (service as any).processStateChange(container, state);

    it('should initialize on first poll without emitting events', () => {
      processStateChange('ac-worldserver', 'running');

      expect(mockEventService.logEvent).not.toHaveBeenCalled();
      expect(mockWebhookService.sendNotification).not.toHaveBeenCalled();
    });

    it('should not emit events when state remains running', () => {
      processStateChange('ac-worldserver', 'running'); // init
      processStateChange('ac-worldserver', 'running'); // same state

      expect(mockEventService.logEvent).not.toHaveBeenCalled();
    });

    it('should log crash + send webhook when running -> exited', () => {
      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'exited');

      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'crash',
        expect.stringContaining('running'),
      );
      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'crash',
        'high',
        expect.stringContaining('crashed'),
        expect.any(String),
      );
    });

    it('should log crash when running -> dead', () => {
      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'dead');

      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'crash',
        expect.stringContaining('dead'),
      );
    });

    it('should log recovery with downtime when exited -> running', () => {
      processStateChange('ac-worldserver', 'running');

      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      processStateChange('ac-worldserver', 'exited');

      jest.setSystemTime(new Date('2024-01-01T00:00:30Z'));
      processStateChange('ac-worldserver', 'running');

      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'recovery',
        'Container recovered',
        expect.any(Number),
      );
    });

    it('should trigger autoRestart when enabled and no crash loop', () => {
      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'exited');

      // autoRestart should have been called (async, will be pending)
      // We verify by checking that dockerService.restartContainer will eventually be called
      // Need to advance timers for the cooldown
      jest.advanceTimersByTime(200);
    });

    it('should not trigger autoRestart when disabled', () => {
      // Access private field to disable
      (service as any).autoRestartEnabled = false;

      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'exited');

      jest.advanceTimersByTime(1000);

      // restartContainer should not be called
      expect(mockDockerService.restartContainer).not.toHaveBeenCalled();
    });

    it('should not trigger autoRestart when crash loop is active', () => {
      (service as any).trackers['ac-worldserver'].crashLoopActive = true;

      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'exited');

      jest.advanceTimersByTime(1000);

      expect(mockDockerService.restartContainer).not.toHaveBeenCalled();
    });

    it('should not trigger autoRestart when restart already in progress', () => {
      (service as any).trackers['ac-worldserver'].restartInProgress = true;

      processStateChange('ac-worldserver', 'running');
      processStateChange('ac-worldserver', 'exited');

      jest.advanceTimersByTime(1000);

      // Should only have the initial restartContainer from the first crash
      expect(mockDockerService.restartContainer).not.toHaveBeenCalled();
    });
  });

  describe('autoRestart', () => {
    const autoRestart = (container: string) =>
      (service as any).autoRestart(container);

    it('should successfully restart on first attempt', async () => {
      mockDockerService.restartContainer.mockResolvedValue({ state: 'running' });
      mockDockerService.getContainerState.mockResolvedValue({ state: 'running' });

      const promise = autoRestart('ac-worldserver');
      // Advance past cooldown and settle wait
      await jest.advanceTimersByTimeAsync(5000);
      await promise;

      expect(mockDockerService.restartContainer).toHaveBeenCalledWith('ac-worldserver');
      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'restart_success',
        expect.stringContaining('Recovered on attempt 1'),
        undefined,
      );
    });

    it('should skip worldserver restart when authserver is down', async () => {
      (service as any).trackers['ac-authserver'].previousState = 'exited';

      const promise = autoRestart('ac-worldserver');
      await jest.advanceTimersByTimeAsync(5000);
      await promise;

      expect(mockDockerService.restartContainer).not.toHaveBeenCalled();
      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'restart_skipped',
        expect.stringContaining('authserver'),
      );
    });

    it('should retry up to maxRetries', async () => {
      mockDockerService.restartContainer.mockResolvedValue({ state: 'exited' });
      mockDockerService.getContainerState.mockResolvedValue({ state: 'exited' });

      const promise = autoRestart('ac-worldserver');
      await jest.advanceTimersByTimeAsync(30000);
      await promise;

      expect(mockDockerService.restartContainer).toHaveBeenCalledTimes(3);
    });

    it('should send restart_failed webhook when all retries exhausted', async () => {
      mockDockerService.restartContainer.mockResolvedValue({ state: 'exited' });
      mockDockerService.getContainerState.mockResolvedValue({ state: 'exited' });

      const promise = autoRestart('ac-worldserver');
      await jest.advanceTimersByTimeAsync(30000);
      await promise;

      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'restart_failed',
        'critical',
        expect.stringContaining('restart failed'),
        expect.stringContaining('exhausted'),
      );
    });
  });

  describe('checkCrashLoop', () => {
    const checkCrashLoop = (container: string) =>
      (service as any).checkCrashLoop(container);

    it('should activate crash loop when crash count >= threshold', () => {
      mockEventService.countEventsSince
        .mockReturnValueOnce(0) // restart_success
        .mockReturnValueOnce(3); // crash

      checkCrashLoop('ac-worldserver');

      expect((service as any).trackers['ac-worldserver'].crashLoopActive).toBe(true);
      expect(mockWebhookService.sendNotification).toHaveBeenCalledWith(
        'crash_loop',
        'critical',
        expect.stringContaining('CRASH LOOP'),
        expect.any(String),
      );
    });

    it('should not activate crash loop when count < threshold', () => {
      mockEventService.countEventsSince
        .mockReturnValueOnce(1) // restart_success
        .mockReturnValueOnce(2); // crash

      checkCrashLoop('ac-worldserver');

      expect((service as any).trackers['ac-worldserver'].crashLoopActive).toBe(false);
    });

    it('should activate crash loop when restart count >= threshold', () => {
      mockEventService.countEventsSince
        .mockReturnValueOnce(3) // restart_success
        .mockReturnValueOnce(0); // crash

      checkCrashLoop('ac-worldserver');

      expect((service as any).trackers['ac-worldserver'].crashLoopActive).toBe(true);
    });

    it('should not activate when both counts below threshold', () => {
      mockEventService.countEventsSince
        .mockReturnValueOnce(2) // restart_success
        .mockReturnValueOnce(2); // crash

      checkCrashLoop('ac-worldserver');

      expect((service as any).trackers['ac-worldserver'].crashLoopActive).toBe(false);
    });
  });

  describe('processSoapHealth', () => {
    const processSoapHealth = (connected: boolean) =>
      (service as any).processSoapHealth(connected);

    it('should mark degraded after 3 failures', () => {
      processSoapHealth(false); // 1
      processSoapHealth(false); // 2
      processSoapHealth(false); // 3

      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'soap_degraded',
        expect.any(String),
      );
    });

    it('should log recovery after degraded state', () => {
      // Reach degraded state
      processSoapHealth(false);
      processSoapHealth(false);
      processSoapHealth(false);
      jest.clearAllMocks();

      // Recover
      processSoapHealth(true);

      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'soap_recovered',
        expect.any(String),
      );
    });

    it('should not be degraded with only 1-2 failures', () => {
      processSoapHealth(false);
      processSoapHealth(false);

      expect(mockEventService.logEvent).not.toHaveBeenCalledWith(
        'ac-worldserver',
        'soap_degraded',
        expect.any(String),
      );
    });

    it('should reset fail count on success', () => {
      processSoapHealth(false);
      processSoapHealth(false);
      processSoapHealth(true); // reset

      expect((service as any).trackers['ac-worldserver'].soapFailCount).toBe(0);
    });
  });

  describe('clearCrashLoop', () => {
    it('should clear crash loop state and log event', () => {
      (service as any).trackers['ac-worldserver'].crashLoopActive = true;
      (service as any).trackers['ac-worldserver'].crashedAt = Date.now();

      service.clearCrashLoop('ac-worldserver');

      expect((service as any).trackers['ac-worldserver'].crashLoopActive).toBe(false);
      expect((service as any).trackers['ac-worldserver'].crashedAt).toBeNull();
      expect(mockEventService.logEvent).toHaveBeenCalledWith(
        'ac-worldserver',
        'crash_loop_cleared',
        expect.any(String),
      );
    });

    it('should not error for unknown container', () => {
      expect(() => service.clearCrashLoop('unknown-container')).not.toThrow();
    });
  });

  describe('loadSettingsOverrides', () => {
    it('should override defaults from settings', () => {
      mockEventService.getAllSettings.mockReturnValue({
        autoRestartEnabled: 'false',
        autoRestartCooldown: '20000',
        autoRestartMaxRetries: '5',
        autoRestartRetryInterval: '30000',
        crashLoopThreshold: '5',
        crashLoopWindow: '600000',
      });

      service.loadSettingsOverrides();

      expect((service as any).autoRestartEnabled).toBe(false);
      expect((service as any).cooldownMs).toBe(20000);
      expect((service as any).maxRetries).toBe(5);
      expect((service as any).retryIntervalMs).toBe(30000);
      expect((service as any).crashLoopThreshold).toBe(5);
      expect((service as any).crashLoopWindowMs).toBe(600000);
    });

    it('should handle partial overrides', () => {
      mockEventService.getAllSettings.mockReturnValue({
        autoRestartEnabled: 'false',
      });

      service.loadSettingsOverrides();

      expect((service as any).autoRestartEnabled).toBe(false);
      // Other values should stay at their constructor defaults
      expect((service as any).maxRetries).toBe(3);
    });

    it('should keep defaults when no settings exist', () => {
      mockEventService.getAllSettings.mockReturnValue({});

      service.loadSettingsOverrides();

      expect((service as any).autoRestartEnabled).toBe(true);
    });
  });
});
