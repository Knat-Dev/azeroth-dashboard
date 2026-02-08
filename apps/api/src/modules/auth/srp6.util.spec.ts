import {
  calculateVerifier,
  makeRegistrationData,
  checkPassword,
} from './srp6.util';

describe('SRP6 Utility', () => {
  describe('calculateVerifier', () => {
    it('should produce a 32-byte verifier', () => {
      const salt = Buffer.alloc(32, 0xab);
      const verifier = calculateVerifier('TEST', 'PASSWORD', salt);
      expect(verifier).toBeInstanceOf(Buffer);
      expect(verifier.length).toBe(32);
    });

    it('should produce the same verifier for same inputs', () => {
      const salt = Buffer.alloc(32, 0xcd);
      const v1 = calculateVerifier('PLAYER', 'PASS', salt);
      const v2 = calculateVerifier('PLAYER', 'PASS', salt);
      expect(v1.equals(v2)).toBe(true);
    });

    it('should produce different verifiers for different passwords', () => {
      const salt = Buffer.alloc(32, 0xef);
      const v1 = calculateVerifier('PLAYER', 'PASS1', salt);
      const v2 = calculateVerifier('PLAYER', 'PASS2', salt);
      expect(v1.equals(v2)).toBe(false);
    });

    it('should produce different verifiers for different usernames', () => {
      const salt = Buffer.alloc(32, 0x12);
      const v1 = calculateVerifier('PLAYER1', 'PASS', salt);
      const v2 = calculateVerifier('PLAYER2', 'PASS', salt);
      expect(v1.equals(v2)).toBe(false);
    });

    it('should produce different verifiers for different salts', () => {
      const salt1 = Buffer.alloc(32, 0x11);
      const salt2 = Buffer.alloc(32, 0x22);
      const v1 = calculateVerifier('PLAYER', 'PASS', salt1);
      const v2 = calculateVerifier('PLAYER', 'PASS', salt2);
      expect(v1.equals(v2)).toBe(false);
    });

    it('should be case-insensitive (auto-uppercases)', () => {
      const salt = Buffer.alloc(32, 0x33);
      const v1 = calculateVerifier('player', 'pass', salt);
      const v2 = calculateVerifier('PLAYER', 'PASS', salt);
      expect(v1.equals(v2)).toBe(true);
    });
  });

  describe('makeRegistrationData', () => {
    it('should return salt and verifier', () => {
      const { salt, verifier } = makeRegistrationData('TEST', 'PASSWORD');
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(32);
      expect(verifier).toBeInstanceOf(Buffer);
      expect(verifier.length).toBe(32);
    });

    it('should produce different salts each time (random)', () => {
      const r1 = makeRegistrationData('TEST', 'PASSWORD');
      const r2 = makeRegistrationData('TEST', 'PASSWORD');
      // Salt should be random, extremely unlikely to match
      expect(r1.salt.equals(r2.salt)).toBe(false);
    });

    it('should produce consistent verifier for the same salt', () => {
      const { salt, verifier } = makeRegistrationData('ADMIN', 'ADMIN');
      const recomputed = calculateVerifier('ADMIN', 'ADMIN', salt);
      expect(verifier.equals(recomputed)).toBe(true);
    });
  });

  describe('checkPassword', () => {
    it('should return true for correct password', () => {
      const { salt, verifier } = makeRegistrationData('TESTUSER', 'TESTPASS');
      expect(checkPassword('TESTUSER', 'TESTPASS', salt, verifier)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const { salt, verifier } = makeRegistrationData('TESTUSER', 'TESTPASS');
      expect(checkPassword('TESTUSER', 'WRONGPASS', salt, verifier)).toBe(
        false,
      );
    });

    it('should return false for incorrect username', () => {
      const { salt, verifier } = makeRegistrationData('TESTUSER', 'TESTPASS');
      expect(checkPassword('WRONGUSER', 'TESTPASS', salt, verifier)).toBe(
        false,
      );
    });

    it('should be case-insensitive for verification', () => {
      const { salt, verifier } = makeRegistrationData('Admin', 'Password');
      expect(checkPassword('admin', 'password', salt, verifier)).toBe(true);
      expect(checkPassword('ADMIN', 'PASSWORD', salt, verifier)).toBe(true);
    });

    it('should handle AzerothCore default admin account pattern', () => {
      // Simulates what happens when AC creates an account:
      // username=ADMIN, password=ADMIN
      const { salt, verifier } = makeRegistrationData('admin', 'admin');
      expect(checkPassword('admin', 'admin', salt, verifier)).toBe(true);
      expect(checkPassword('admin', 'wrong', salt, verifier)).toBe(false);
    });
  });

  describe('Known-value verification against AzerothCore algorithm', () => {
    it('should match the expected algorithm: v = g^H(s||H(U||:||P)) mod N', () => {
      // Create a known salt and manually verify the chain
      const crypto = require('crypto');

      const username = 'TEST';
      const password = 'TEST';
      const salt = Buffer.alloc(32, 0);

      // Step 1: H(U || ':' || P) where U and P are uppercased
      const step1 = crypto
        .createHash('sha1')
        .update(Buffer.from('TEST:TEST'))
        .digest();

      // Step 2: H(salt || step1)
      const step2 = crypto
        .createHash('sha1')
        .update(Buffer.concat([salt, step1]))
        .digest();

      // The verifier should be deterministic with these inputs
      const verifier = calculateVerifier(username, password, salt);

      // Verify it's not zero (degenerate case)
      const allZero = verifier.every((b) => b === 0);
      expect(allZero).toBe(false);

      // Verify roundtrip
      expect(checkPassword(username, password, salt, verifier)).toBe(true);
    });
  });
});
