export interface KaspaRpcErrorContext {
  rpc_method: string;
  rpc_network: string;
  rpc_endpoint_source: 'configured' | 'resolver';
  rpc_endpoint_index?: string;
  rpc_encoding: 'borsh';
}

const rpcErrorContexts = new WeakMap<object, KaspaRpcErrorContext>();

export function isMalformedKaspaRpcResponseError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return /error processing json: missing field [`']?id[`']?/i.test(message);
}

export function annotateKaspaRpcError(
  error: unknown,
  context: KaspaRpcErrorContext,
): Error {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error), { cause: error });
  rpcErrorContexts.set(normalizedError, context);
  return normalizedError;
}

export function getKaspaRpcErrorContext(
  error: unknown,
): KaspaRpcErrorContext | undefined {
  return typeof error === 'object' && error !== null
    ? rpcErrorContexts.get(error)
    : undefined;
}
