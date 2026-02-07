import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DockerService } from '../docker/docker.service.js';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private dockerService: DockerService) {}

  async listContainers() {
    return this.dockerService.listContainers();
  }

  async getContainerLogs(
    containerName: string,
    tail = 500,
  ): Promise<{ logs: string; error?: string }> {
    if (!this.dockerService.isAllowedContainer(containerName)) {
      return { logs: '', error: 'Container not allowed' };
    }

    try {
      const raw = await this.dockerService.dockerRequest(
        `/v1.45/containers/${containerName}/logs?stdout=1&stderr=1&tail=${tail}`,
      );
      const logs = this.dockerService.stripMultiplexedHeaders(raw);
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

  async streamLogs(
    containerName: string,
    tail: number,
    res: Response,
  ): Promise<void> {
    if (!this.dockerService.isAllowedContainer(containerName)) {
      res.status(400).json({ error: 'Container not allowed' });
      return;
    }

    const info = await this.dockerService.inspectContainer(containerName);
    const isTty = info.tty;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let path = `/v1.45/containers/${containerName}/logs?stdout=1&stderr=1&follow=1`;
    const sinceEpoch = info.startedAt
      ? Math.floor(new Date(info.startedAt).getTime() / 1000)
      : 0;
    if (sinceEpoch > 0) {
      path += `&since=${sinceEpoch}`;
    } else {
      path += `&tail=${tail}`;
    }

    let muxBuffer: Uint8Array = Buffer.alloc(0);

    const req = this.dockerService.createStreamRequest(
      path,
      (dockerRes) => {
        dockerRes.on('data', (chunk: Buffer) => {
          try {
            if (isTty) {
              this.sendSseLines(res, chunk.toString('utf-8'));
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
      (err) => {
        this.logger.error(`Docker request error: ${err.message}`);
        try {
          res.write(
            `data: ${JSON.stringify({ error: err.message })}\n\n`,
          );
          res.end();
        } catch {
          // Ignore
        }
      },
    );

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
      const payload = buf
        .subarray(offset + 8, offset + 8 + size)
        .toString('utf-8');
      offset += 8 + size;
      this.sendSseLines(res, payload);
    }
    return buf.subarray(offset);
  }
}
