import { createHash, randomBytes } from 'crypto';

// AzerothCore SRP6 constants
// g = 7 (generator)
const g = 7n;

// N is stored as little-endian in AC source via HexStrToByteArray with true flag
// Hex (big-endian): 894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7
const N = hexToBigInt(
  '894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7',
);

function hexToBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

// Convert little-endian byte Buffer to BigInt
function bufferToBigInt(buf: Buffer): bigint {
  // Reverse to big-endian, then convert to hex
  const hex = Buffer.from(buf).reverse().toString('hex');
  if (hex.length === 0) return 0n;
  return BigInt('0x' + hex);
}

// Convert BigInt to little-endian byte Buffer of specified length
function bigIntToBuffer(n: bigint, length: number): Buffer {
  const hex = n.toString(16).padStart(length * 2, '0');
  const buf = Buffer.from(hex, 'hex');
  // Reverse from big-endian to little-endian
  buf.reverse();
  // Ensure exact length
  if (buf.length < length) {
    return Buffer.concat([buf, Buffer.alloc(length - buf.length)]);
  }
  return buf.subarray(0, length);
}

function sha1(...buffers: Buffer[]): Buffer {
  const hash = createHash('sha1');
  for (const buf of buffers) {
    hash.update(buf);
  }
  return hash.digest();
}

/**
 * Calculate SRP6 verifier matching AzerothCore's CalculateVerifier.
 *
 * v = g ^ H(salt || H(UPPER(username) || ':' || UPPER(password))) mod N
 *
 * Salt and verifier are stored as little-endian 32-byte arrays in the DB.
 */
export function calculateVerifier(
  username: string,
  password: string,
  salt: Buffer,
): Buffer {
  const usernameUpper = username.toUpperCase();
  const passwordUpper = password.toUpperCase();

  // Step 1: H(username || ':' || password) — 20 bytes
  const step1 = sha1(Buffer.from(usernameUpper + ':' + passwordUpper));

  // Step 2: H(salt || step1) — this is x
  const x = sha1(salt, step1);

  // Step 3: v = g^x mod N
  const xBigInt = bufferToBigInt(x);
  const v = modPow(g, xBigInt, N);

  return bigIntToBuffer(v, 32);
}

/**
 * Generate registration data (salt + verifier) for a new account.
 * Matches AzerothCore's SRP6::MakeRegistrationData.
 */
export function makeRegistrationData(
  username: string,
  password: string,
): { salt: Buffer; verifier: Buffer } {
  const salt = randomBytes(32);
  const verifier = calculateVerifier(username, password, salt);
  return { salt, verifier };
}

/**
 * Verify a password against stored salt and verifier.
 * Matches AzerothCore's SRP6::CheckLogin.
 */
export function checkPassword(
  username: string,
  password: string,
  salt: Buffer,
  storedVerifier: Buffer,
): boolean {
  const computedVerifier = calculateVerifier(username, password, salt);
  return computedVerifier.equals(storedVerifier);
}
