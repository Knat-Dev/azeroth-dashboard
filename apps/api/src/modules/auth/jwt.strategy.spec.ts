import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { createMockConfigService } from '../../shared/test-utils';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = createMockConfigService({
      'jwt.secret': 'test-secret',
    });
    strategy = new JwtStrategy(configService as any);
  });

  it('should map {sub, username, gmLevel} to {id, username, gmLevel}', () => {
    const payload: JwtPayload = { sub: 42, username: 'ADMIN', gmLevel: 3 };
    const result = strategy.validate(payload);

    expect(result).toEqual({
      id: 42,
      username: 'ADMIN',
      gmLevel: 3,
    });
  });

  it('should preserve all payload fields correctly', () => {
    const payload: JwtPayload = { sub: 1, username: 'PLAYER', gmLevel: 0 };
    const result = strategy.validate(payload);

    expect(result.id).toBe(1);
    expect(result.username).toBe('PLAYER');
    expect(result.gmLevel).toBe(0);
  });
});
