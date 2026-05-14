/**
 * Fixture wallets used for onboarding / import E2E tests.
 *
 * These are freshly-generated, valid BIP39 mnemonics with no funds on any
 * network. They are committed on purpose: tests that drive the import UI
 * need a seed the wallet SDK will accept, and an unfunded seed has no
 * security value to protect.
 *
 * Pre-funded testnet wallets for send / swap tests are injected at runtime
 * via the `KASPA_E2E_SEED` env var (GitHub Actions org secret), never from
 * this file. Never put a funded seed here.
 */

export const TEST_PASSWORD = 'WalletE2E!Password1';

// Fresh 12-word BIP39 mnemonic, generated 2026-04-20. Unfunded.
export const BIP39_TEST_SEED_12 =
  'client later lock verify knife lift obtain grant divorce siege rural time';

// Fresh 24-word BIP39 mnemonic, generated 2026-04-20. Unfunded.
export const BIP39_TEST_SEED_24 =
  'inch shift seed outside offer chimney puzzle chat talent issue love trash tiny assault wrestle skirt begin north announce clean peanut safe benefit essence';

// secp256k1 private key (hex). Well-known test key, no funds anywhere.
export const TEST_PRIVATE_KEY_HEX =
  '0000000000000000000000000000000000000000000000000000000000000001';

// Clearly-invalid seed used to test the error path.
export const INVALID_SEED_12 =
  'notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword';

/**
 * Read the pre-funded TN10 seed from the environment. Returns undefined if
 * unset, so tests can skip (rather than fail loudly) when running against
 * a local env without the secret configured.
 */
export function getFundedSeed(): string | undefined {
  const seed = process.env.KASPA_E2E_SEED?.trim();
  return seed && seed.split(/\s+/).length >= 12 ? seed : undefined;
}
