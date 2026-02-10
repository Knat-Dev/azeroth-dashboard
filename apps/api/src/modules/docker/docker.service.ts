import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as http from 'http';

const DOCKER_REQUEST_TIMEOUT_MS = 15_000;

interface DockerContainerJson {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Image: string;
}

export interface ContainerInfo {
  name: string;
  state: string;
  status: string;
  image: string;
}

export interface ContainerState {
  state: string;
  status: string;
  startedAt: string | null;
}

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private readonly socketPath = '/var/run/docker.sock';

  private readonly allowedContainers: string[] = (
    process.env.ALLOWED_CONTAINERS ?? 'ac-worldserver,ac-authserver'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  private validateContainer(name: string): void {
    if (!this.allowedContainers.includes(name)) {
      throw new BadRequestException(
        `Container "${name}" is not in the allowlist`,
      );
    }
  }

  /** Raw GET request to the Docker Engine API via Unix socket. */
  dockerRequest(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method: 'GET',
          timeout: DOCKER_REQUEST_TIMEOUT_MS,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks);
            if (res.statusCode && res.statusCode >= 400) {
              reject(
                new Error(
                  `Docker API error ${res.statusCode}: ${raw.toString('utf-8')}`,
                ),
              );
              return;
            }
            resolve(raw);
          });
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Docker API request timed out'));
      });
      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  /** Raw POST request to the Docker Engine API via Unix socket. */
  private dockerPost(path: string, timeoutMs = DOCKER_REQUEST_TIMEOUT_MS): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method: 'POST',
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const raw = Buffer.concat(chunks);
            if (res.statusCode && res.statusCode >= 400) {
              reject(
                new Error(
                  `Docker API error ${res.statusCode}: ${raw.toString('utf-8')}`,
                ),
              );
              return;
            }
            resolve(raw);
          });
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Docker API request timed out'));
      });
      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  /** List allowed containers with their state. */
  async listContainers(): Promise<ContainerInfo[]> {
    try {
      const data = await this.dockerRequest('/v1.45/containers/json?all=true');
      const containers: DockerContainerJson[] = JSON.parse(
        data.toString('utf-8'),
      );
      return containers
        .filter((c) =>
          c.Names.some((n) =>
            this.allowedContainers.includes(n.replace(/^\//, '')),
          ),
        )
        .map((c) => ({
          name: c.Names[0].replace(/^\//, ''),
          state: c.State,
          status: c.Status,
          image: c.Image,
        }));
    } catch (err) {
      this.logger.error(`Failed to list containers: ${err}`);
      return [];
    }
  }

  /** Inspect a container — returns full Docker inspect JSON. */
  async inspectContainer(name: string): Promise<{
    tty: boolean;
    startedAt: string | null;
    state: string;
    status: string;
  }> {
    this.validateContainer(name);
    try {
      const data = await this.dockerRequest(`/v1.45/containers/${name}/json`);
      const info = JSON.parse(data.toString('utf-8'));
      return {
        tty: info.Config?.Tty === true,
        startedAt: info.State?.StartedAt ?? null,
        state: info.State?.Status ?? 'unknown',
        status: info.Status ?? '',
      };
    } catch {
      return { tty: false, startedAt: null, state: 'unknown', status: '' };
    }
  }

  /** Get container state summary. */
  async getContainerState(name: string): Promise<ContainerState> {
    const info = await this.inspectContainer(name);
    return {
      state: info.state,
      status: info.status,
      startedAt: info.startedAt,
    };
  }

  /** Restart a container. Returns the new container state. */
  async restartContainer(name: string, timeout = 10): Promise<ContainerState> {
    this.validateContainer(name);
    const httpTimeoutMs = (timeout + 10) * 1000;
    try {
      await this.dockerPost(`/v1.45/containers/${name}/restart?t=${timeout}`, httpTimeoutMs);
      this.logger.log(`Container ${name} restarted`);
    } catch (err) {
      this.logger.error(`Failed to restart container ${name}: ${err}`);
      throw err;
    }
    return this.getContainerState(name);
  }

  /** Stop a container. Returns the new container state. */
  async stopContainer(name: string, timeout = 30): Promise<ContainerState> {
    this.validateContainer(name);
    // HTTP timeout = Docker stop timeout + 10s buffer for Docker overhead
    const httpTimeoutMs = (timeout + 10) * 1000;
    try {
      await this.dockerPost(`/v1.45/containers/${name}/stop?t=${timeout}`, httpTimeoutMs);
      this.logger.log(`Container ${name} stopped`);
    } catch (err) {
      // 304 = already stopped — not an error
      if (err instanceof Error && err.message.includes('304')) {
        this.logger.log(`Container ${name} already stopped`);
      } else {
        this.logger.error(`Failed to stop container ${name}: ${err}`);
        throw err;
      }
    }
    return this.getContainerState(name);
  }

  /** Start a container. Returns the new container state. */
  async startContainer(name: string): Promise<ContainerState> {
    this.validateContainer(name);
    try {
      await this.dockerPost(`/v1.45/containers/${name}/start`);
      this.logger.log(`Container ${name} started`);
    } catch (err) {
      // 304 = already running — not an error
      if (err instanceof Error && err.message.includes('304')) {
        this.logger.log(`Container ${name} already running`);
      } else {
        this.logger.error(`Failed to start container ${name}: ${err}`);
        throw err;
      }
    }
    return this.getContainerState(name);
  }

  /** Create a raw streaming HTTP request to Docker (for log streaming). */
  createStreamRequest(
    path: string,
    onResponse: (res: http.IncomingMessage) => void,
    onError: (err: Error) => void,
  ): http.ClientRequest {
    const req = http.request(
      { socketPath: this.socketPath, path, method: 'GET' },
      onResponse,
    );
    req.on('error', onError);
    req.end();
    return req;
  }

  /** Strip Docker multiplexed stream headers from a buffer. */
  stripMultiplexedHeaders(buf: Buffer): string {
    if (buf.length < 8) return buf.toString('utf-8');

    const firstByte = buf[0];
    if (
      (firstByte === 0 || firstByte === 1 || firstByte === 2) &&
      buf[1] === 0 &&
      buf[2] === 0 &&
      buf[3] === 0
    ) {
      const lines: string[] = [];
      let offset = 0;
      while (offset + 8 <= buf.length) {
        const size = buf.readUInt32BE(offset + 4);
        if (offset + 8 + size > buf.length) break;
        const payload = buf.subarray(offset + 8, offset + 8 + size);
        lines.push(payload.toString('utf-8'));
        offset += 8 + size;
      }
      return lines.join('');
    }

    return buf.toString('utf-8');
  }

  isAllowedContainer(name: string): boolean {
    return this.allowedContainers.includes(name);
  }

  /** Get CPU and memory stats for a container (no allowlist check — internal use). */
  async getContainerStats(
    name: string,
  ): Promise<{ cpuPercent: number; memoryUsageMB: number; memoryLimitMB: number } | null> {
    try {
      const data = await this.dockerRequest(
        `/v1.45/containers/${name}/stats?stream=false`,
      );
      const stats = JSON.parse(data.toString('utf-8'));

      // CPU % — normalized to total system capacity (0-100%) so it's
      // directly comparable to host CPU from /proc/stat.
      // systemDelta already spans all cores, so no numCpus multiplier.
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage -
        stats.precpu_stats.system_cpu_usage;
      const cpuPercent =
        systemDelta > 0
          ? Math.round((cpuDelta / systemDelta) * 100 * 100) / 100
          : 0;

      // Memory
      const cache = stats.memory_stats.stats?.cache ?? 0;
      const memoryUsageMB =
        Math.round(((stats.memory_stats.usage - cache) / 1024 / 1024) * 100) /
        100;
      const memoryLimitMB =
        Math.round((stats.memory_stats.limit / 1024 / 1024) * 100) / 100;

      return { cpuPercent, memoryUsageMB, memoryLimitMB };
    } catch (err) {
      this.logger.debug(`Failed to get stats for ${name}: ${err}`);
      return null;
    }
  }
}
