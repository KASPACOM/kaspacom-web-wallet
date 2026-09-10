import {
  claimChunkRecovery,
  isStaleChunkError,
} from './chunk-load-recovery';

describe('chunk load recovery', () => {
  it('recognizes stale lazy module failures without matching ordinary errors', () => {
    expect(
      isStaleChunkError(
        new TypeError('Failed to fetch dynamically imported module'),
      ),
    ).toBeTrue();
    expect(isStaleChunkError(new Error('RPC disconnected'))).toBeFalse();
  });

  it('allows one reload per deployed release', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(claimChunkRecovery(storage, 'wallet@abc')).toBeTrue();
    expect(claimChunkRecovery(storage, 'wallet@abc')).toBeFalse();
    expect(claimChunkRecovery(storage, 'wallet@def')).toBeTrue();
  });
});
