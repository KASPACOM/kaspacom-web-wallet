import { dotkSignatureBytes } from './dotk-signing';

describe('dotkSignatureBytes', () => {
  const signature = `${'ab'.repeat(64)}01`;

  it('removes the canonical push byte returned by Kaspa WASM', () => {
    const result = dotkSignatureBytes(`41${signature}`);

    expect(result.length).toBe(65);
    expect(result[0]).toBe(0xab);
    expect(result[64]).toBe(0x01);
  });

  it('accepts an already-unwrapped 65-byte signature', () => {
    expect(Array.from(dotkSignatureBytes(signature))).toEqual(
      Array.from(dotkSignatureBytes(`41${signature}`)),
    );
  });

  it('refuses a signature without SIGHASH_ALL', () => {
    expect(() => dotkSignatureBytes(`${'ab'.repeat(64)}c3`)).toThrowError(
      'Dot.K transactions must be signed with SIGHASH_ALL',
    );
  });
});
