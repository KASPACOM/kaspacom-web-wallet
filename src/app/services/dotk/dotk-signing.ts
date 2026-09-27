const CANONICAL_SIGNATURE_PUSH = 0x41;
const DOTK_SIGNATURE_LENGTH = 65;
const SIGHASH_ALL = 0x01;

/**
 * Kaspa WASM returns a complete canonical signature script (0x41 followed by
 * the 65-byte signature), while @dotk/sdk-tx asks its signer adapter for the
 * signature bytes themselves.
 */
export function dotkSignatureBytes(signatureHex: string): Uint8Array {
  if (signatureHex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(signatureHex)) {
    throw new Error('Dot.K signer returned invalid hexadecimal data');
  }

  let signature = Uint8Array.from(
    signatureHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );

  if (
    signature.length === DOTK_SIGNATURE_LENGTH + 1 &&
    signature[0] === CANONICAL_SIGNATURE_PUSH
  ) {
    signature = signature.slice(1);
  }

  if (signature.length !== DOTK_SIGNATURE_LENGTH) {
    throw new Error(
      `Dot.K signer returned ${signature.length} signature bytes; expected ${DOTK_SIGNATURE_LENGTH}`,
    );
  }

  if (signature[DOTK_SIGNATURE_LENGTH - 1] !== SIGHASH_ALL) {
    throw new Error('Dot.K transactions must be signed with SIGHASH_ALL');
  }

  return signature;
}
