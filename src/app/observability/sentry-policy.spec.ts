import {
  applyWalletSentryPolicy,
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
});
