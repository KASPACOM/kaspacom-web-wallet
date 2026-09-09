import {
  computeDegradedL2WalletState,
  computeFreshL2WalletState,
} from './l2-wallet-state';
import { L2WalletState } from './AppWallet';

describe('L2 wallet state', () => {
  it('marks a successful balance read as fresh', () => {
    const state = computeFreshL2WalletState(1, {
      address: '0xabc',
      balance: 1500000000000000000n,
      nativeCurrencyDecimals: 18,
    });

    expect(state).toEqual({
      chainId: 1,
      address: '0xabc',
      balance: 1500000000000000000n,
      balanceFormatted: 1.5,
      availability: 'fresh',
    });
  });

  it('falls back to zero when the formatted balance is not a number', () => {
    const state = computeFreshL2WalletState(1, {
      address: '0xabc',
      balance: 0n,
      nativeCurrencyDecimals: 18,
    });

    expect(state.balanceFormatted).toBe(0);
  });

  it('keeps the previous balance as stale when the failure is on the same chain', () => {
    const previous: L2WalletState = {
      chainId: 1,
      address: '0xabc',
      balance: 42n,
      balanceFormatted: 4.2,
      availability: 'fresh',
    };

    const state = computeDegradedL2WalletState(1, previous);

    expect(state).toEqual({
      chainId: 1,
      address: '0xabc',
      balance: 42n,
      balanceFormatted: 4.2,
      availability: 'stale',
    });
  });

  it('resets to unavailable when the failure follows a chain switch', () => {
    const previous: L2WalletState = {
      chainId: 1,
      address: '0xabc',
      balance: 42n,
      balanceFormatted: 4.2,
      availability: 'fresh',
    };

    const state = computeDegradedL2WalletState(56, previous);

    expect(state).toEqual({
      chainId: 56,
      address: undefined,
      balance: 0n,
      balanceFormatted: 0,
      availability: 'unavailable',
    });
  });

  it('reports unavailable when there is no previous state at all', () => {
    const state = computeDegradedL2WalletState(1, undefined);

    expect(state).toEqual({
      chainId: 1,
      address: undefined,
      balance: 0n,
      balanceFormatted: 0,
      availability: 'unavailable',
    });
  });
});
