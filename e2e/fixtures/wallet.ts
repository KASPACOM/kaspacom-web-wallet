/**
 * Fixture wallets used for onboarding E2E tests.
 *
 * These are publicly known BIP39 test vectors with zero balance on any network.
 * Do NOT use a production seed here. Pre-funded testnet wallets for send/swap
 * tests are injected at runtime via the KASPA_E2E_SEED env var.
 */

export const TEST_PASSWORD = 'WalletE2E!Password1';

// BIP39 test vector — entropy 0x00000000000000000000000000000000
export const BIP39_TEST_SEED_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// BIP39 test vector — entropy 0x0000…0000 (256-bit)
export const BIP39_TEST_SEED_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

// secp256k1 private key (hex). Well-known test key, no funds anywhere.
export const TEST_PRIVATE_KEY_HEX =
  '0000000000000000000000000000000000000000000000000000000000000001';

// Clearly-invalid seed used to test error paths.
export const INVALID_SEED_12 =
  'notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword notaword';
