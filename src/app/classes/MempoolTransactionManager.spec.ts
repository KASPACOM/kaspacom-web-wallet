import { MempoolTransactionManager } from './MempoolTransactionManager';

describe('MempoolTransactionManager', () => {
  it('contains malformed responses from background refreshes', async () => {
    const malformedResponse = new Error(
      'Error processing JSON: missing field id at line 1 column 30479',
    );
    const rpc = {
      getMempoolEntriesByAddresses: jasmine
        .createSpy('getMempoolEntriesByAddresses')
        .and.rejectWith(malformedResponse),
    };
    const onRpcError = jasmine
      .createSpy('onRpcError')
      .and.callFake((error: unknown) => error as Error);
    const manager = new MempoolTransactionManager(
      rpc as never,
      'kaspatest:fixture',
      onRpcError,
    );

    manager.refreshMempoolTransactionsInBackground();
    await new Promise((resolve) => setTimeout(resolve));

    expect(onRpcError).toHaveBeenCalledWith(
      malformedResponse,
      'getMempoolEntriesByAddresses',
      true,
    );
    expect(onRpcError).toHaveBeenCalledTimes(1);
  });

  it('logs unexpected errors from background refreshes instead of swallowing them', async () => {
    const unexpectedError = new Error('network timeout');
    const rpc = {
      getMempoolEntriesByAddresses: jasmine
        .createSpy('getMempoolEntriesByAddresses')
        .and.rejectWith(unexpectedError),
    };
    const onRpcError = jasmine
      .createSpy('onRpcError')
      .and.callFake((error: unknown) => error as Error);
    const manager = new MempoolTransactionManager(
      rpc as never,
      'kaspatest:fixture',
      onRpcError,
    );
    spyOn(console, 'warn');

    manager.refreshMempoolTransactionsInBackground();
    await new Promise((resolve) => setTimeout(resolve));

    expect(console.warn).toHaveBeenCalledWith(
      'Background mempool refresh failed',
      unexpectedError,
    );
  });

  it('does not double-log a malformed response that was already reported by onRpcError', async () => {
    const malformedResponse = new Error(
      'Error processing JSON: missing field id at line 1 column 30479',
    );
    const rpc = {
      getMempoolEntriesByAddresses: jasmine
        .createSpy('getMempoolEntriesByAddresses')
        .and.rejectWith(malformedResponse),
    };
    const onRpcError = jasmine
      .createSpy('onRpcError')
      .and.callFake((error: unknown) => error as Error);
    const manager = new MempoolTransactionManager(
      rpc as never,
      'kaspatest:fixture',
      onRpcError,
    );
    spyOn(console, 'warn');

    manager.refreshMempoolTransactionsInBackground();
    await new Promise((resolve) => setTimeout(resolve));

    expect(console.warn).not.toHaveBeenCalled();
  });
});
