/**
 * TN10 (testnet-10) network fixtures for send / swap E2E tests.
 *
 * URLs mirror those in src/environments/environment.development.ts. Keep in
 * sync when the dev environment changes endpoints.
 */

export const TN10 = {
  kaspaApiBaseurl: 'https://api-tn10.kaspa.org',
  explorerBaseurl: 'https://explorer-tn10.kaspa.org',
  // A known-valid TN10 burn / faucet return address used as a safe send
  // destination when tests don't care about the receiver. Replace when the
  // community faucet rotates.
  neutralDestAddress: 'kaspatest:qrjcg7hsgjapumpn8egyu6544qzdqs2lssas4nfwewl55xt62z8jq5rwc3nwq',
} as const;

export const KASPLEX_TESTNET = {
  rpcUrl: 'https://rpc.kasplextest.xyz',
  explorerBaseurl: 'https://explorer.testnet.kasplextest.xyz',
  chainId: 167012,
} as const;

export const IGRA_TESTNET = {
  rpcUrl: 'https://galleon-testnet.igralabs.com:8545',
  explorerBaseurl: 'https://explorer.galleon-testnet.igralabs.com',
  chainId: 38836,
  wrappedTokenAddress: '0x394C68684F9AFCEb9b804531EF07a864E8081738',
} as const;
