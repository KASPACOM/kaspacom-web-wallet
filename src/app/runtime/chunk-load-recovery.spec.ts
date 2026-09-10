import {
  claimChunkRecovery,
  installChunkLoadRecovery,
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

  it('gives up quietly when storage is blocked instead of throwing from the error handler', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      'sessionStorage',
    );
    const reloadSpy = jasmine.createSpy('reload');
    const preventDefault = jasmine.createSpy('preventDefault');
    let onError: ((event: unknown) => void) | undefined;

    spyOn(window, 'addEventListener').and.callFake(
      (type: string, handler: unknown) => {
        if (type === 'error') {
          onError = handler as (event: unknown) => void;
        }
      },
    );

    try {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new Error('SecurityError: storage is blocked');
        },
      });
      installChunkLoadRecovery('wallet@abc', reloadSpy);

      expect(onError).toBeDefined();
      expect(() =>
        onError!({
          error: new TypeError('Failed to fetch dynamically imported module'),
          preventDefault,
        }),
      ).not.toThrow();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'sessionStorage', descriptor);
      }
    }

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('reloads once when a stale chunk error arrives and storage works', () => {
    const reloadSpy = jasmine.createSpy('reload');
    const preventDefault = jasmine.createSpy('preventDefault');
    let onError: ((event: unknown) => void) | undefined;

    spyOn(window, 'addEventListener').and.callFake(
      (type: string, handler: unknown) => {
        if (type === 'error') {
          onError = handler as (event: unknown) => void;
        }
      },
    );
    installChunkLoadRecovery(`wallet@${Date.now()}`, reloadSpy);

    onError!({
      error: new TypeError('Failed to fetch dynamically imported module'),
      preventDefault,
    });

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
  });
});
