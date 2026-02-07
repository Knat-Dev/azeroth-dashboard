import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import type { Response } from 'express';

interface ContainerInfo {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Image: string;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private readonly socketPath = '/var/run/docker.sock';

  private readonly allowedContainers = [
    'ac-worldserver',
    'ac-authserver',
  ];

  private dockerRequest(path: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method: 'GET',
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
      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  private stripMultiplexedHeaders(buf: Buffer): string {
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

  async listContainers(): Promise<
    { name: string; state: string; status: string; image: string }[]
  > {
    try {
      const data = await this.dockerRequest(
        '/v1.45/containers/json?all=true',
      );
      const containers: ContainerInfo[] = JSON.parse(data.toString('utf-8'));
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

  async getContainerLogs(
    containerName: string,
    tail = 500,
  ): Promise<{ logs: string; error?: string }> {
    if (!this.allowedContainers.includes(containerName)) {
      return { logs: '', error: 'Container not allowed' };
    }

    try {
      const raw = await this.dockerRequest(
        `/v1.45/containers/${containerName}/logs?stdout=1&stderr=1&tail=${tail}`,
      );
      const logs = this.stripMultiplexedHeaders(raw);
      return { logs };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to get logs for ${containerName}: ${message}`);
      return {
        logs: '',
        error: message.includes('ENOENT')
          ? 'Docker socket not available. Mount /var/run/docker.sock to enable container logs.'
          : `Failed to fetch logs: ${message}`,
      };
    }
  }

  async inspectContainer(
    name: string,
  ): Promise<{ tty: boolean; startedAt: string | null }> {
    try {
      const data = await this.dockerRequest(
        `/v1.45/containers/${name}/json`,
      );
      const info = JSON.parse(data.toString('utf-8'));
      return {
        tty: info.Config?.Tty === true,
        startedAt: info.State?.StartedAt ?? null,
      };
    } catch {
      return { tty: false, startedAt: null };
    }
  }

  async streamLogs(
    containerName: string,
    tail: number,
    res: Response,
  ): Promise<void> {
    if (!this.allowedContainers.includes(containerName)) {
      res.status(400).json({ error: 'Container not allowed' });
      return;
    }

    const { tty: isTty, startedAt } =
      await this.inspectContainer(containerName);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Only show logs from the current run
    let path = `/v1.45/containers/${containerName}/logs?stdout=1&stderr=1&follow=1`;
    const sinceEpoch = startedAt
      ? Math.floor(new Date(startedAt).getTime() / 1000)
      : 0;
    if (sinceEpoch > 0) {
      path += `&since=${sinceEpoch}`;
    } else {
      path += `&tail=${tail}`;
    }

    const req = http.request(
      {
        socketPath: this.socketPath,
        path,
        method: 'GET',
      },
      (dockerRes) => {
        let muxBuffer: Uint8Array = Buffer.alloc(0);

        dockerRes.on('data', (chunk: Buffer) => {
          try {
            if (isTty) {
              const text = chunk.toString('utf-8');
              this.sendSseLines(res, text);
            } else {
              muxBuffer = Buffer.concat([muxBuffer, chunk]);
              muxBuffer = this.parseMuxFrames(Buffer.from(muxBuffer), res);
            }
          } catch {
            // Ignore write errors (client disconnected)
          }
        });

        dockerRes.on('end', () => {
          try {
            res.write('event: end\ndata: stream ended\n\n');
            res.end();
          } catch {
            // Ignore
          }
        });

        dockerRes.on('error', (err) => {
          this.logger.error(`Docker stream error: ${err.message}`);
          try {
            res.end();
          } catch {
            // Ignore
          }
        });
      },
    );

    req.on('error', (err) => {
      this.logger.error(`Docker request error: ${err.message}`);
      try {
        res.write(
          `data: ${JSON.stringify({ error: err.message })}\n\n`,
        );
        res.end();
      } catch {
        // Ignore
      }
    });

    req.end();

    res.on('close', () => {
      req.destroy();
    });
  }

  private sendSseLines(res: Response, text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.length > 0) {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      }
    }
  }

  private parseMuxFrames(buf: Buffer, res: Response): Uint8Array {
    let offset = 0;
    while (offset + 8 <= buf.length) {
      const size = buf.readUInt32BE(offset + 4);
      if (offset + 8 + size > buf.length) break;
      const payload = buf.subarray(offset + 8, offset + 8 + size).toString('utf-8');
      offset += 8 + size;
      this.sendSseLines(res, payload);
    }
    return buf.subarray(offset);
  }
}
