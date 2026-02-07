import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DockerService } from '../docker/docker.service.js';
import { SoapService } from '../admin/soap.service.js';
import { Character } from '../../entities/characters/character.entity.js';

export interface ContainerHealth {
  state: string;
  status: string;
}

export interface HealthState {
  worldserver: ContainerHealth;
  authserver: ContainerHealth;
  soap: { connected: boolean };
  players: { online: number };
  lastUpdated: string;
}

const POLL_INTERVAL_MS = 5000;
const SOAP_TIMEOUT_MS = 3000;

@Injectable()
export class MonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  private cachedHealth: HealthState = {
    worldserver: { state: 'unknown', status: '' },
    authserver: { state: 'unknown', status: '' },
    soap: { connected: false },
    players: { online: 0 },
    lastUpdated: new Date().toISOString(),
  };

  private previousState: {
    worldserver: string;
    authserver: string;
  } = {
    worldserver: 'unknown',
    authserver: 'unknown',
  };

  constructor(
    private dockerService: DockerService,
    private soapService: SoapService,
    @InjectRepository(Character, 'characters')
    private characterRepo: Repository<Character>,
  ) {}

  onModuleInit() {
    this.logger.log(
      `Starting health monitor (polling every ${POLL_INTERVAL_MS / 1000}s)`,
    );
    // Run immediately on startup, then poll
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Health monitor stopped');
    }
  }

  /** Returns the cached health state — zero I/O per call. */
  getHealth(): HealthState {
    return this.cachedHealth;
  }

  private async poll(): Promise<void> {
    try {
      const [worldState, authState, soapOk, onlineCount] = await Promise.all([
        this.dockerService.getContainerState('ac-worldserver'),
        this.dockerService.getContainerState('ac-authserver'),
        this.checkSoap(),
        this.countOnlinePlayers(),
      ]);

      // Detect state changes for future event logging (Phase 2)
      const prevWorld = this.previousState.worldserver;
      const prevAuth = this.previousState.authserver;
      if (prevWorld !== 'unknown' && prevWorld !== worldState.state) {
        this.logger.log(
          `Worldserver state changed: ${prevWorld} -> ${worldState.state}`,
        );
      }
      if (prevAuth !== 'unknown' && prevAuth !== authState.state) {
        this.logger.log(
          `Authserver state changed: ${prevAuth} -> ${authState.state}`,
        );
      }

      this.previousState = {
        worldserver: worldState.state,
        authserver: authState.state,
      };

      this.cachedHealth = {
        worldserver: { state: worldState.state, status: worldState.status },
        authserver: { state: authState.state, status: authState.status },
        soap: { connected: soapOk },
        players: { online: onlineCount },
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error(`Health poll failed: ${err}`);
    }
  }

  private async checkSoap(): Promise<boolean> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SOAP timeout')), SOAP_TIMEOUT_MS),
      );
      const soapPromise = this.soapService.executeCommand('.server info');
      const result = await Promise.race([soapPromise, timeoutPromise]);
      return result.success;
    } catch {
      return false;
    }
  }

  private async countOnlinePlayers(): Promise<number> {
    try {
      const result = await this.characterRepo.count({
        where: { online: 1 },
      });
      return result;
    } catch {
      return 0;
    }
  }
}
