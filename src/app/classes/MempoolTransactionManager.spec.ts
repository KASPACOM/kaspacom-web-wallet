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
});
