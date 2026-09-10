const CHUNK_ERROR_PATTERNS = [
  'chunkloaderror',
  'loading chunk',
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
];

export function isStaleChunkError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === 'string'
        ? reason
        : '';
  const normalized = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function claimChunkRecovery(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  release: string,
): boolean {
  const key = `wallet:chunk-recovery:${release}`;
  if (storage.getItem(key)) return false;
  storage.setItem(key, new Date().toISOString());
  return true;
}

export function installChunkLoadRecovery(
  release: string,
  reload: () => void = () => window.location.reload(),
): void {
  if (typeof window === 'undefined') return;

  const recover = (reason: unknown, event: Event) => {
    if (!isStaleChunkError(reason)) return;

    let claimed = false;
    try {
      claimed = claimChunkRecovery(window.sessionStorage, release);
    } catch {
      // Storage is blocked (cross-origin iframe on iOS Safari, private mode):
      // reading it throws, and this runs inside an error handler. Give up on
      // recovery rather than raising a second error from here.
      return;
    }

    if (!claimed) return;

    event.preventDefault();
    reload();
  };

  window.addEventListener('error', (event) => recover(event.error, event));
  window.addEventListener('unhandledrejection', (event) =>
    recover(event.reason, event),
  );
}
