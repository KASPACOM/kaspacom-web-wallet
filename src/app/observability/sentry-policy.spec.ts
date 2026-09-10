import {
  applyWalletSentryPolicy,
  beforeBreadcrumb,
  beforeSendSpan,
  beforeSendTransaction,
  getWalletSentryEnvironment,
  sanitizeSentryPath,
  sanitizeSentryUrl,
} from './sentry-policy';
import { annotateKaspaRpcError } from './kaspa-rpc-errors';

describe('wallet Sentry policy', () => {
  it('classifies only the production wallet host as production', () => {
    expect(getWalletSentryEnvironment('wallet.kaspa.com')).toBe('production');
    expect(getWalletSentryEnvironment('dev-wallet.kaspa.com')).toBe(
      'development',
    );
    expect(getWalletSentryEnvironment('localhost')).toBe('development');
  });

  it('removes query data and dynamic identifiers from URLs', () => {
    expect(
      sanitizeSentryUrl(
        `https://wallet.kaspa.com/app/home/transaction/${'a'.repeat(64)}?address=secret`,
      ),
    ).toBe('https://wallet.kaspa.com/app/home/transaction/:id');
  });

  it('drops expected wallet cancellations', () => {
    expect(
      applyWalletSentryPolicy({}, { originalException: { code: 4001 } }),
    ).toBeNull();
    expect(
      applyWalletSentryPolicy({ message: 'MetaMask is not installed on iOS' }),
    ).toBeNull();
  });

  it('keeps actionable errors while removing user and request headers', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      user?: unknown;
      request: { url?: string; headers?: Record<string, unknown> };
      tags?: Record<string, unknown>;
    }>(
      {
        message: 'RPC unavailable',
        user: { id: 'private' },
        request: {
          url: 'https://wallet.kaspa.com/app/home',
          headers: { authorization: 'private' },
        },
      },
      undefined,
      'wallet.kaspa.com',
    );

    expect(event).not.toBeNull();
    expect(event?.user).toBeUndefined();
    expect(event?.request?.headers).toBeUndefined();
    expect(event?.tags?.['deployment_host']).toBe('wallet.kaspa.com');
  });

  it('classifies malformed Kaspa RPC responses without storing payload data', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      tags: Record<string, unknown>;
    }>({
      message:
        'Error processing JSON: missing field `id` at line 1 column 30479',
      tags: {},
    });

    expect(event?.tags?.['error_family']).toBe('malformed_rpc_response');
    expect(event?.tags?.['rpc_protocol']).toBe('kaspa-wrpc');
  });

  it('adds safe operation context to an annotated malformed RPC response', () => {
    const error = annotateKaspaRpcError(
      new Error(
        'Error processing JSON: missing field id at line 1 column 30479',
      ),
      {
        rpc_method: 'getMempoolEntriesByAddresses',
        rpc_network: 'testnet-10',
        rpc_endpoint_source: 'configured',
        rpc_endpoint_index: '1',
        rpc_encoding: 'borsh',
      },
    );

    const event = applyWalletSentryPolicy<{
      message: string;
      tags: Record<string, unknown>;
    }>({ message: error.message, tags: {} }, { originalException: error });

    expect(event?.tags?.['rpc_method']).toBe('getMempoolEntriesByAddresses');
    expect(event?.tags?.['rpc_network']).toBe('testnet-10');
    expect(event?.tags?.['rpc_endpoint_source']).toBe('configured');
    expect(event?.tags?.['rpc_endpoint_index']).toBe('1');
    expect(event?.tags?.['rpc_encoding']).toBe('borsh');
    expect(JSON.stringify(event)).not.toContain('tn10-node.kaspa.com');
  });

  it('scrubs sensitive values out of event contexts and extra', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      contexts: {
        startup: { route: string; error_message: string; wasm_path: string };
      };
      extra: { wallet_address: string };
    }>({
      message: 'Bootstrap failed',
      contexts: {
        startup: {
          route: '/app/home/asset/erc20/0x' + 'a'.repeat(40),
          error_message:
            'Failed to fetch dynamically imported module https://wallet.kaspa.com/app/home/asset/erc20/0x' +
            'b'.repeat(40) +
            '?wallet=kaspatest:' +
            'c'.repeat(30),
          wasm_path: './kaspa/kaspa_bg.wasm?v=1',
        },
      },
      extra: {
        wallet_address: 'kaspatest:' + 'd'.repeat(30),
      },
    });

    expect(event?.contexts.startup.route).toBe(
      '/app/home/asset/erc20/:id',
    );
    expect(event?.contexts.startup.error_message).not.toContain('0x' + 'b'.repeat(40));
    expect(event?.contexts.startup.error_message).not.toContain(
      'kaspatest:' + 'c'.repeat(30),
    );
    expect(event?.extra.wallet_address).not.toContain(
      'kaspatest:' + 'd'.repeat(30),
    );
  });

  it('redacts sensitive field names regardless of their value shape', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      extra: {
        authorization: string;
        apiKey: string;
        nested: { session_token: string; note: string };
      };
    }>({
      message: 'Bootstrap failed',
      extra: {
        authorization: 'Bearer opaque-token-that-is-not-hex-or-kaspa',
        apiKey: 'plain-secret-value',
        nested: {
          session_token: 'plain-session-value',
          note: 'this note is not sensitive',
        },
      },
    });

    expect(event?.extra.authorization).toBe('[redacted]');
    expect(event?.extra.apiKey).toBe('[redacted]');
    expect(event?.extra.nested.session_token).toBe('[redacted]');
    expect(event?.extra.nested.note).toBe('this note is not sensitive');
  });

  it('strips query-string credentials from URLs embedded anywhere in a value', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      contexts: { startup: { error_message: string } };
    }>({
      message: 'Bootstrap failed',
      contexts: {
        startup: {
          error_message:
            'GET https://rpc.example.com/v1?apiKey=verysecrettoken123 failed',
        },
      },
    });

    expect(event?.contexts.startup.error_message).not.toContain(
      'verysecrettoken123',
    );
    expect(event?.contexts.startup.error_message).not.toContain('apiKey');
  });

  it('sanitizes a relative wallet route embedded in a non-path-keyed context field', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      contexts: { startup: { error_message: string } };
    }>({
      message: 'Bootstrap failed',
      contexts: {
        startup: {
          error_message:
            'Failed while opening /app/home/asset/krc20/private-ticker',
        },
      },
    });

    expect(event?.contexts.startup.error_message).toBe(
      'Failed while opening /app/home/asset/krc20/:id',
    );
  });

  it('sanitizes a relative wallet route embedded in an arbitrary extra field', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      extra: { debug_note: string };
    }>({
      message: 'Bootstrap failed',
      extra: {
        debug_note: 'redirected from /app/home/asset/krc20/private-ticker',
      },
    });

    expect(event?.extra.debug_note).toBe(
      'redirected from /app/home/asset/krc20/:id',
    );
  });

  it('sanitizes a relative wallet route embedded in a non-navigation breadcrumb message', () => {
    const breadcrumb = beforeBreadcrumb({
      category: 'console',
      message: 'Failed while opening /app/home/asset/krc20/private-ticker',
    });

    expect(breadcrumb.message).toBe(
      'Failed while opening /app/home/asset/krc20/:id',
    );
  });

  it('strips the query string from an embedded static wallet route that has no sensitive segment', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      contexts: { startup: { error_message: string } };
    }>({
      message: 'Bootstrap failed',
      contexts: {
        startup: {
          error_message: 'redirected to /app/collectables?apiKey=opaque-secret',
        },
      },
    });

    expect(event?.contexts.startup.error_message).toBe(
      'redirected to /app/collectables',
    );
  });

  it('drops every request field that can carry the query, session, or environment', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      request: {
        url?: string;
        headers?: Record<string, unknown>;
        data?: unknown;
        query_string?: unknown;
        cookies?: unknown;
        env?: unknown;
      };
    }>({
      message: 'RPC unavailable',
      request: {
        url: 'https://wallet.kaspa.com/app/collectables?apiKey=opaque-secret',
        headers: { authorization: 'Bearer secret' },
        data: { body: 'secret' },
        query_string: 'apiKey=opaque-secret',
        cookies: { session: 'opaque-session-value' },
        env: { SECRET_KEY: 'value' },
      },
    });

    expect(event?.request.url).toBe('https://wallet.kaspa.com/app/collectables');
    expect(event?.request.headers).toBeUndefined();
    expect(event?.request.data).toBeUndefined();
    expect(event?.request.query_string).toBeUndefined();
    expect(event?.request.cookies).toBeUndefined();
    expect(event?.request.env).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain('opaque-secret');
    expect(JSON.stringify(event)).not.toContain('opaque-session-value');
  });

  it('scrubs the structured logentry alongside the plain message', () => {
    const event = applyWalletSentryPolicy<{
      logentry: { message?: string; params?: unknown[] };
    }>({
      logentry: {
        message: 'opening /app/home/asset/krc20/private-ticker',
        params: ['kaspatest:' + 'd'.repeat(30)],
      },
    });

    expect(event?.logentry.message).toBe(
      'opening /app/home/asset/krc20/:id',
    );
    expect(event?.logentry.params?.[0]).toBe('[redacted]');
  });

  it('refuses non-plain objects instead of letting them through unscrubbed', () => {
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    const event = applyWalletSentryPolicy<{
      extra: { cause: unknown; occurred_at: unknown; plain: { note: string } };
    }>({
      extra: {
        cause: new Error('failed for kaspatest:' + 'd'.repeat(30)),
        occurred_at: timestamp,
        plain: { note: 'kept' },
      },
    });

    expect(event?.extra.cause).toBe('[unserialized]');
    expect(event?.extra.occurred_at).toBe(timestamp);
    expect((event?.extra.plain as { note: string }).note).toBe('kept');
    expect(JSON.stringify(event)).not.toContain('d'.repeat(30));
  });

  it('redacts a credential-shaped tag set by other code', () => {
    const event = applyWalletSentryPolicy<{
      message: string;
      tags: Record<string, unknown>;
    }>({
      message: 'Bootstrap failed',
      tags: { apiKey: 'opaque-secret', screen: 'collectables' },
    });

    expect(event?.tags?.['apiKey']).toBe('[redacted]');
    expect(event?.tags?.['screen']).toBe('collectables');
  });

  it('strips query strings from embedded routes outside the /app namespace', () => {
    const embedded = [
      'redirected to /onboarding?token=opaque-secret',
      'see /guides/create-kaspa-wallet?ref=opaque-secret',
      'redirect /onboarding?returnUrl=/app/home&t=opaque-secret',
      'opening /nft/marketplace?owner=opaque-secret',
    ];

    for (const note of embedded) {
      const event = applyWalletSentryPolicy<{ extra: { note: string } }>({
        extra: { note },
      });
      const breadcrumb = beforeBreadcrumb({
        category: 'console',
        message: note,
      });

      expect(event?.extra.note).not.toContain('opaque-secret');
      expect(breadcrumb.message).not.toContain('opaque-secret');
    }
  });

  it('drops a query or fragment even when handed straight to sanitizeSentryPath', () => {
    expect(sanitizeSentryPath('/app/collectables?apiKey=opaque-secret')).toBe(
      '/app/collectables',
    );
    expect(sanitizeSentryPath('/app/collectables#opaque-secret')).toBe(
      '/app/collectables',
    );
  });

  it('strips the query string from a transaction name with no sensitive segment', () => {
    const transaction = beforeSendTransaction({
      type: 'transaction' as const,
      transaction: '/app/collectables?apiKey=opaque-secret',
    });

    expect(transaction.transaction).toBe('/app/collectables');
  });

  it('sanitizes traced wallet routes, spans, and navigation breadcrumbs', () => {
    const cyclicData: Record<string, unknown> = {};
    cyclicData['self'] = cyclicData;
    const transaction = beforeSendTransaction({
      type: 'transaction' as const,
      transaction: '/app/home/asset/krc20/KASPER/transaction/' + 'a'.repeat(64),
    });
    const span = beforeSendSpan({
      description:
        'GET https://wallet.kaspa.com/app/home/asset/erc20/0x' +
        'b'.repeat(40) +
        '?wallet=private',
      data: {
        'http.url':
          'https://wallet.kaspa.com/app/home/transaction/kaspa/' +
          'c'.repeat(64),
      },
    });
    const breadcrumb = beforeBreadcrumb({
      category: 'navigation',
      message: '/app/home/asset/krc20/PRIVATE',
      data: {
        from: '/app/home/asset/krc721/COLLECTION/123',
        to: '/app/home/asset/kns/private-domain',
        context: cyclicData,
      },
    });

    expect(transaction.transaction).toBe(
      '/app/home/asset/krc20/:id/transaction/:id',
    );
    expect(span.description).toBe(
      'GET https://wallet.kaspa.com/app/home/asset/erc20/:id',
    );
    expect(span.data['http.url']).toBe(
      'https://wallet.kaspa.com/app/home/transaction/kaspa/:id',
    );
    expect(breadcrumb.data?.['from']).toBe('/app/home/asset/krc721/:id');
    expect(breadcrumb.data?.['to']).toBe('/app/home/asset/kns/:id');
    expect(breadcrumb.message).toBe('/app/home/asset/krc20/:id');
    expect(
      (breadcrumb.data?.['context'] as Record<string, unknown>)['self'],
    ).toBe('[circular]');
    expect(
      beforeSendSpan({ description: 'ui.angular.render', data: {} })
        .description,
    ).toBe('ui.angular.render');
  });
});
