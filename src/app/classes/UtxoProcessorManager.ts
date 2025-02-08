import { signal } from '@angular/core';
import {
  RpcClient,
  UtxoContext,
  UtxoProcessor,
} from '../../../public/kaspa/kaspa';
import {
  BalanceData,
  BalanceEvent,
} from '../types/kaspa-network/balance-event.interface';
import { UtxoChangedEvent } from '../types/kaspa-network/utxo-changed-event.interface';

const WAIT_TIMEOUT = 20 * 1000;
const REJECT_TRANSACTION_TIMEOUT = 20 * 1000;
const WAIT_TIMEOUT_FOR_UTXO_BALANCE = 20 * 1000;

export class UtxoProcessorManager {
  private processor: UtxoProcessor | undefined = undefined;
  private context: UtxoContext | undefined = undefined;

  private processorEventListenerPromise: Promise<unknown> | undefined =
    undefined;
  private processorEventListenerResolve: undefined | ((v?: any) => void) =
    undefined;
  private processorEventListenerReject: undefined | ((error: any) => void) =
    undefined;
  private processorEventListenerTimeout: undefined | NodeJS.Timeout = undefined;
  private processorEventListenerTimoutReached: boolean = false;

  private processorHandlerWithBind: (() => Promise<void>) | undefined =
    undefined;
  private balanceEventHandlerWithBind:
    | ((event: any) => Promise<void>)
    | undefined = undefined;

  private utxoChangedEventListenerWithBind: ((event: any) => void) | undefined =
    undefined;

  private balancePromise: undefined | Promise<any> = undefined;
  private balanceResolve: undefined | ((v?: any) => void) = undefined;
  private balanceResolveTimeout: undefined | NodeJS.Timeout = undefined;
  private isBalancedResolved = true;
  private transactionPromises: {
    [transactionId: string]: {
      promise: Promise<any>;
      resolve: (value?: any) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    };
  } = {};

  private walletBalanceStateSignal = signal<BalanceData | undefined>(undefined);

  constructor(
    private readonly rpc: RpcClient,
    private readonly network: string,
    private readonly publicAddress: string,
    private readonly onBalanceUpdate: () => Promise<any>
  ) {
    this.processorHandlerWithBind = this.processorEventListener.bind(this);
    this.balanceEventHandlerWithBind = this.balanceEventHandler.bind(this);
    this.utxoChangedEventListenerWithBind =
      this.utxoChangedEventListener.bind(this);

    this.processor = new UtxoProcessor({
      rpc: this.rpc,
      networkId: this.network,
    });

    this.context = new UtxoContext({ processor: this.processor });
  }

  async init() {
    await this.registerEventHandlers();
  }

  getContext(): UtxoContext | undefined {
    return this.context;
  }

  private initBalancePromiseAndTimeout() {
    this.isBalancedResolved = false;
    this.balancePromise = new Promise((resolve) => {
      this.balanceResolve = resolve;
    });

    if (this.balanceResolveTimeout) {
      clearTimeout(this.balanceResolveTimeout);
      this.balanceResolveTimeout = undefined;
    }

    const balanceResolveTimeoutFunction = async () => {
      try {
        await this.processorEventListenerPromise;
      } catch (error) {
        console.error(error);
        this.balanceResolveTimeout = undefined;
        return;
      }

      await this.context?.clear();
      await this.context?.trackAddresses([this.publicAddress]);
      this.balanceResolveTimeout = setTimeout(
        balanceResolveTimeoutFunction,
        WAIT_TIMEOUT_FOR_UTXO_BALANCE
      );
    };

    this.balanceResolveTimeout = setTimeout(
      balanceResolveTimeoutFunction,
      WAIT_TIMEOUT_FOR_UTXO_BALANCE
    );

    if (this.context?.balance?.pending === 0n) {
      this.balanceReceived();
    }
  }

  private balanceReceived() {
    if (this.balanceResolveTimeout) {
      clearTimeout(this.balanceResolveTimeout);
      this.balanceResolveTimeout = undefined;
    }
    this.isBalancedResolved = true;
    this.balanceResolve!();
  }

  private async balanceEventHandler(event: BalanceEvent) {
    if (event.type == 'pending') {
      this.walletBalanceStateSignal.set(event.data.balance);
      this.onBalanceUpdate();

      if (!this.isBalancedResolved) {
        this.initBalancePromiseAndTimeout();
      }
    } else if (event.type == 'balance') {
      this.walletBalanceStateSignal.set(event.data.balance);
      this.onBalanceUpdate();

      if (!this.isBalancedResolved) {
        const currentHasPending = event.data.balance.pending > 0;
        if (!currentHasPending) {
          this.balanceReceived();
        }
      }
    }
  }

  private async processorEventListener() {
    if (this.processorEventListenerTimoutReached) {
      return;
    }

    clearTimeout(this.processorEventListenerTimeout);

    try {
      await this.context!.clear();
      await this.context!.trackAddresses([this.publicAddress]);
      this.initBalancePromiseAndTimeout();
      this.processorEventListenerResolve!();
    } catch (error) {
      this.processorEventListenerReject!(error);
    }
  }

  private async registerEventHandlers() {
    if (this.processorEventListenerPromise) {
      throw new Error('This object can be used only once');
    }

    this.rpc.subscribeUtxosChanged([this.publicAddress]);
    await this.rpc.addEventListener(this.utxoChangedEventListenerWithBind!);

    await this.registerProcessor();
  }

  async dispose(): Promise<void> {
    if (this.balanceResolveTimeout) {
      clearTimeout(this.balanceResolveTimeout);
      this.balanceResolveTimeout = undefined;
    }

    await this.stopAndUnregisterProcessor();
    this.context!.clear();
  }

  private async registerProcessor() {
    this.processorEventListenerTimeout = setTimeout(() => {
      this.processorEventListenerTimoutReached = true;
      this.processorEventListenerReject!(
        'Timeout on Transaction completion at registerProcessor()'
      );
      this.dispose();
    }, WAIT_TIMEOUT);

    this.processorEventListenerPromise = new Promise((resolve, reject) => {
      this.processorEventListenerResolve = resolve;
      this.processorEventListenerReject = reject;
    });

    this.processor!.addEventListener(
      'utxo-proc-start',
      this.processorHandlerWithBind!
    );
    this.processor!.addEventListener(
      'balance',
      this.balanceEventHandlerWithBind!
    );
    this.processor!.addEventListener(
      'pending',
      this.balanceEventHandlerWithBind!
    );
    await this.processor!.start();

    return await this.processorEventListenerPromise;
  }

  private async stopAndUnregisterProcessor() {
    await this.processor!.stop();
    this.processor!.removeEventListener(
      'utxo-proc-start',
      this.processorHandlerWithBind
    );
    this.processor!.removeEventListener('utxo-proc-start');
    this.processor!.removeEventListener(
      'balance',
      this.balanceEventHandlerWithBind
    );
    this.processor!.removeEventListener('balance');
    this.processor!.removeEventListener(
      'pending',
      this.balanceEventHandlerWithBind
    );
    this.processor!.removeEventListener('pending');

    this.rpc.unsubscribeUtxosChanged([this.publicAddress]);
    this.rpc.removeEventListener(
      'utxos-changed',
      this.utxoChangedEventListenerWithBind
    );
  }

  async getTransactionPromise(transactionId: string) {
    let resolve: any = undefined;
    let reject: any = undefined;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const timeout = setTimeout(() => {
      this.rejectTransaction(transactionId);
    }, REJECT_TRANSACTION_TIMEOUT);

    this.transactionPromises[transactionId] = {
      resolve,
      reject,
      timeout,
      promise,
    };

    return promise;
  }

  private utxoChangedEventListener(event: UtxoChangedEvent) {

    const addedTransactions = event.data?.added?.map(
      (entry: any) => entry.outpoint.transactionId
    );
    const removedTransactions = event.data?.removed?.map(
      (entry: any) => entry.outpoint.transactionId
    );

    const distinctTransactions = Array.from(
      new Set([...(addedTransactions || []), ...(removedTransactions || [])])
    );

    distinctTransactions.forEach((transactionId) => {
      if (this.transactionPromises[transactionId]) {
        this.resolveTransaction(transactionId);
      }
    });
  }

  resolveTransaction(transactionId: string) {
    if (this.transactionPromises[transactionId]) {
      this.transactionPromises[transactionId].resolve();
      clearTimeout(this.transactionPromises[transactionId].timeout);
      delete this.transactionPromises[transactionId];
    }
  }

  rejectTransaction(transactionId: string) {
    if (this.transactionPromises[transactionId]) {
      this.transactionPromises[transactionId].reject('TIMEOUT ON TRANSACTION');
      delete this.transactionPromises[transactionId];
    }
  }

  async waitForPendingUtxoToFinish() {
    if (this.balancePromise) {
      await this.balancePromise;
    }
  }

  getUtxoBalanceStateSignal() {
    return this.walletBalanceStateSignal.asReadonly();
  }
}
