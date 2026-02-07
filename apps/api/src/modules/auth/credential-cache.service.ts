import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CredentialCacheService {
  private readonly cache = new Map<number, { iv: string; encrypted: string }>();
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.secret', 'change-me');
    // Derive a 32-byte key from the JWT secret via SHA-256
    this.key = Buffer.from(
      require('crypto').createHash('sha256').update(secret).digest(),
    );
  }

  store(userId: number, password: string): void {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(password, 'utf8'),
      cipher.final(),
    ]);
    this.cache.set(userId, {
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
    });
  }

  retrieve(userId: number): string | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    const decipher = createDecipheriv(
      'aes-256-cbc',
      this.key,
      Buffer.from(entry.iv, 'hex'),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.encrypted, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  clear(userId: number): void {
    this.cache.delete(userId);
  }
}
