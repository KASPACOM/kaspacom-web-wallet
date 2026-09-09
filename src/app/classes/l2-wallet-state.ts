import { formatUnits } from 'ethers';
import type { L2WalletState } from './AppWallet';

export interface L2WalletBalanceResult {
  address: string;
  balance: bigint;
  nativeCurrencyDecimals: number;
}

export function computeFreshL2WalletState(
  chainId: number,
  result: L2WalletBalanceResult,
): L2WalletState {
  return {
    chainId,
    address: result.address,
    balance: result.balance,
    balanceFormatted:
      parseFloat(formatUnits(result.balance, result.nativeCurrencyDecimals)) ||
      0,
    availability: 'fresh',
  };
}

export function computeDegradedL2WalletState(
  chainId: number,
  previous: L2WalletState | undefined,
): L2WalletState {
  const sameChain = previous?.chainId === chainId;

  return {
    chainId,
    address: sameChain ? previous.address : undefined,
    balance: sameChain ? previous.balance : 0n,
    balanceFormatted: sameChain ? previous.balanceFormatted : 0,
    availability: sameChain ? 'stale' : 'unavailable',
  };
}
