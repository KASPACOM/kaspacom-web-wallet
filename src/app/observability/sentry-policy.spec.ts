import {
  applyWalletSentryPolicy,
  beforeBreadcrumb,
  beforeSendSpan,
  beforeSendTransaction,
  getWalletSentryEnvironment,
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
