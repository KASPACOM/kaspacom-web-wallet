import { blake2b } from '@noble/hashes/blake2b';

/**
 * Convert a 64-char hex string into a 32-byte Uint8Array.
 */
export function hex32ToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Compute a blake2b-256 hash and return lowercase hex.
 */
export function computeBlake2bHex(input: ArrayLike<number>): string {
  const hash = blake2b(Uint8Array.from(input), { dkLen: 32 });
  return Array.from(hash)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
