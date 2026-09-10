import {
  getKaspaRpcErrorContext,
  isMalformedKaspaRpcResponseError,
} from './kaspa-rpc-errors';
import type { Breadcrumb } from '@sentry/angular';

export type WalletSentryEnvironment = 'production' | 'development';

interface SentryEventLike {
  exception?: { values?: Array<{ type?: string; value?: string }> };
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  request?: {
    url?: string;
    headers?: Record<string, unknown>;
    data?: unknown;
    query_string?: unknown;
    cookies?: unknown;
    env?: unknown;
  };
  transaction?: string;
  user?: unknown;
  tags?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

interface SentryHintLike {
  originalException?: unknown;
}

interface SentrySpanLike {
  description?: string;
  data?: Record<string, unknown>;
}

const DYNAMIC_WALLET_ROUTES = [
  /^(\/app\/home\/asset\/(?:krc20|erc20)\/)[^/]+/i,
  /^(\/app\/home\/asset\/krc721\/)[^/]+\/[^/]+/i,
  /^(\/app\/home\/asset\/(?:kns|utxo)\/)[^/]+/i,
  /^(\/app\/home\/transaction\/(?:kaspa|erc20)\/)[^/]+/i,
];

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
const PATH_DATA_KEY =
  /(?:^|[._-])(?:url|path|route|from|to|description)(?:[._-]|$)/i;
const SENSITIVE_DATA_KEY =
  /(?:^|[._-])(?:auth(?:orization)?|bearer|token|api[-_]?key|secret|password|credential|cookie|session|private[-_]?key|mnemonic|seed)(?:[._-]|$)/i;
const EMBEDDED_LOCATION_PATTERN =
  /https?:\/\/[^\s"'<>]+|\/app\/[^\s"'<>]*/gi;

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
    const path = sanitizeSentryPath(url.pathname);
    return /^https?:\/\//i.test(rawUrl) ? `${url.origin}${path}` : path;
  } catch {
    return sanitizeSentryPath(rawUrl.split('?')[0].split('#')[0]);
  }
}

export function sanitizeSentryPath(path: string): string {
  // Defensive: callers must pass a bare pathname, but a query or fragment
  // slipping through here would reach Sentry with its value intact.
  const cleanPath = path.split('?')[0].split('#')[0] || '/';
  const routeTemplate = DYNAMIC_WALLET_ROUTES.reduce(
    (value, pattern) => value.replace(pattern, '$1:id'),
    cleanPath,
  );
  const normalized = routeTemplate
    .split('/')
    .map((segment) => (isSensitivePathSegment(segment) ? ':id' : segment))
    .join('/');
  return normalized || '/';
}

export function beforeSendTransaction<
  T extends SentryEventLike & { type: 'transaction' },
>(event: T): T {
  return applyWalletSentryPolicy(event) as T;
}

export function beforeSendSpan<T extends SentrySpanLike>(span: T): T {
  span.description = sanitizePathValue(span.description);
  if (span.data) span.data = sanitizeSentryData(span.data) as T['data'];
  return span;
}

export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  breadcrumb.message =
    breadcrumb.category === 'navigation'
      ? sanitizePathValue(breadcrumb.message)
      : scrubPrivateValues(breadcrumb.message);
  breadcrumb.data = sanitizeSentryData(breadcrumb.data) as Breadcrumb['data'];
  return breadcrumb;
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
  if (event.logentry) {
    event.logentry.message = scrubPrivateValues(event.logentry.message);
    event.logentry.params = event.logentry.params?.map(
      (param) => sanitizeSentryData(param) as unknown,
    );
  }
  for (const exception of event.exception?.values ?? []) {
    exception.value = scrubPrivateValues(exception.value);
  }
  event.tags = {
    ...(sanitizeSentryData(event.tags) as Record<string, unknown> | undefined),
    deployment_host: hostname || 'server',
  };
  if (event.request) {
    event.request.url = sanitizeSentryUrl(event.request.url);
    event.request.headers = undefined;
    event.request.data = undefined;
    event.request.query_string = undefined;
    event.request.cookies = undefined;
    event.request.env = undefined;
  }
  if (event.transaction) {
    event.transaction = sanitizeSentryUrl(event.transaction);
  }
  if (event.contexts) {
    event.contexts = sanitizeSentryData(event.contexts) as typeof event.contexts;
  }
  if (event.extra) {
    event.extra = sanitizeSentryData(event.extra) as typeof event.extra;
  }
  return event;
}

function scrubPrivateValues(value?: string): string | undefined {
  if (value === undefined) return value;
  const withoutEmbeddedLocations = value.replace(
    EMBEDDED_LOCATION_PATTERN,
    (match) => sanitizeSentryUrl(match) ?? match,
  );
  return withoutEmbeddedLocations.replace(PRIVATE_VALUE_PATTERN, '[redacted]');
}

function sanitizePathValue(value?: string): string | undefined {
  if (!value) return value;
  const methodPrefix = value.match(/^([A-Z]+\s+)(.+)$/);
  if (methodPrefix && isUrlOrPath(methodPrefix[2])) {
    return `${methodPrefix[1]}${scrubPrivateValues(
      sanitizeSentryUrl(methodPrefix[2]),
    )}`;
  }
  return isUrlOrPath(value)
    ? scrubPrivateValues(sanitizeSentryUrl(value))
    : scrubPrivateValues(value);
}

function isUrlOrPath(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function sanitizeSentryData(
  value: unknown,
  key = '',
  seen = new WeakSet<object>(),
): unknown {
  if (key && SENSITIVE_DATA_KEY.test(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string') {
    return PATH_DATA_KEY.test(key)
      ? sanitizePathValue(value)
      : (scrubPrivateValues(value) ?? '');
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeSentryData(item, key, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeSentryData(childValue, childKey, seen),
      ]),
    );
  }
  return value;
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
