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

  it('formats a zero balance as 0', () => {
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

  it('keeps reporting unavailable on repeated same-chain failures when no value was ever fetched', () => {
    const previous: L2WalletState = {
      chainId: 1,
      address: undefined,
      balance: 0n,
      balanceFormatted: 0,
      availability: 'unavailable',
    };

    const state = computeDegradedL2WalletState(1, previous);

    expect(state).toEqual({
      chainId: 1,
      address: undefined,
      balance: 0n,
      balanceFormatted: 0,
      availability: 'unavailable',
    });
  });

  it('keeps chaining a stale value forward across repeated same-chain failures', () => {
    const previous: L2WalletState = {
      chainId: 1,
      address: '0xabc',
      balance: 42n,
      balanceFormatted: 4.2,
      availability: 'stale',
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
});
