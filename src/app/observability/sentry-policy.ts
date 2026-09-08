import {
  getKaspaRpcErrorContext,
  isMalformedKaspaRpcResponseError,
} from './kaspa-rpc-errors';

export type WalletSentryEnvironment = 'production' | 'development';

interface SentryEventLike {
  exception?: { values?: Array<{ type?: string; value?: string }> };
  message?: string;
  request?: { url?: string; headers?: Record<string, unknown>; data?: unknown };
  transaction?: string;
  user?: unknown;
  tags?: Record<string, unknown>;
}

interface SentryHintLike {
  originalException?: unknown;
}

const EXPECTED_ERROR_MESSAGES = [
  'user rejected',
  'user denied',
  'user cancelled',
  'user canceled',
  'user aborted a request',
  'metamask is not installed',
  'metamask not installed',
  'no ethereum provider was found',
];
const PRIVATE_VALUE_PATTERN =
  /kaspa(?:test)?:[a-z0-9]{20,}|0x[a-f0-9]{40,64}\b|\b[a-f0-9]{64}\b/gi;

export function getWalletSentryEnvironment(
  hostname: string,
): WalletSentryEnvironment {
  return hostname.toLowerCase() === 'wallet.kaspa.com'
    ? 'production'
    : 'development';
}

export function sanitizeSentryUrl(
  rawUrl: string | undefined,
): string | undefined {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl, 'https://wallet.kaspa.com');
    return `${url.origin}${sanitizeSentryPath(url.pathname)}`;
  } catch {
    return sanitizeSentryPath(rawUrl.split('?')[0].split('#')[0]);
  }
}

export function sanitizeSentryPath(path: string): string {
  const cleanPath = path || '/';
  const normalized = cleanPath
    .split('/')
    .map((segment) => (isSensitivePathSegment(segment) ? ':id' : segment))
    .join('/');
  return normalized || '/';
}

export function isExpectedWalletError(
  event: SentryEventLike,
  hint?: SentryHintLike,
): boolean {
  const original = hint?.originalException as
    { code?: unknown; name?: unknown; message?: unknown } | undefined;
  if (Number(original?.code) === 4001) return true;

  const values = event.exception?.values ?? [];
  const text = [
    event.message,
    original?.name,
    original?.message,
    ...values.flatMap((value) => [value.type, value.value]),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return EXPECTED_ERROR_MESSAGES.some((message) => text.includes(message));
}

export function applyWalletSentryPolicy<T extends SentryEventLike>(
  event: T,
  hint?: SentryHintLike,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
): T | null {
  if (isExpectedWalletError(event, hint)) return null;

  if (isMalformedKaspaRpcResponse(event, hint)) {
    const rpcContext = getKaspaRpcErrorContext(hint?.originalException);
    event.tags = {
      ...event.tags,
      error_family: 'malformed_rpc_response',
      rpc_protocol: 'kaspa-wrpc',
      ...rpcContext,
    };
  }

  event.user = undefined;
  event.message = scrubPrivateValues(event.message);
  for (const exception of event.exception?.values ?? []) {
    exception.value = scrubPrivateValues(exception.value);
  }
  event.tags = { ...event.tags, deployment_host: hostname || 'server' };
  if (event.request) {
    event.request.url = sanitizeSentryUrl(event.request.url);
    event.request.headers = undefined;
    event.request.data = undefined;
  }
  if (event.transaction) {
    event.transaction = sanitizeSentryPath(event.transaction);
  }
  return event;
}

function scrubPrivateValues(value?: string): string | undefined {
  return value?.replace(PRIVATE_VALUE_PATTERN, '[redacted]');
}

function isMalformedKaspaRpcResponse(
  event: SentryEventLike,
  hint?: SentryHintLike,
): boolean {
  const original = hint?.originalException as { message?: unknown } | undefined;
  const text = [
    event.message,
    original?.message,
    ...(event.exception?.values ?? []).map((value) => value.value),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  return (
    isMalformedKaspaRpcResponseError(hint?.originalException) ||
    /error processing json: missing field [`']id[`']/i.test(text)
  );
}

function isSensitivePathSegment(segment: string): boolean {
  if (!segment) return false;
  if (segment.includes(':')) return true;
  if (/^0x[0-9a-f]{6,}$/i.test(segment)) return true;
  if (/^[0-9a-f]{16,}$/i.test(segment)) return true;
  return segment.length >= 24;
}
