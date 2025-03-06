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
import { IMempoolResult } from '../types/kaspa-network/mempool-result.interface';

const WAIT_TIMEOUT = 20 * 1000;
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


  private walletBalanceStateSignal = signal<BalanceData | undefined>(undefined);


  private waitForOutgoingUtxoPromise: Promise<unknown> | undefined = undefined;
  private waitForOutgoingUtxoResolve: undefined | ((v?: any) => void) = undefined;
  private waitForOutgoingUtxoTimeout: undefined | NodeJS.Timeout = undefined;

  constructor(
    private readonly rpc: RpcClient,
    private readonly network: string,
    private readonly publicAddress: string,
  ) {
    this.processorHandlerWithBind = this.processorEventListener.bind(this);
    this.balanceEventHandlerWithBind = this.balanceEventHandler.bind(this);

    this.processor = new UtxoProcessor({
      rpc: this.rpc,
      networkId: this.network,
    });

    this.context = new UtxoContext({ processor: this.processor });
  }

  async init() {
    await this.registerEventHandlers();
  }

  async getMempoolTransactionsByWalletAddress(walletAddress: string, includeOrphanPool: boolean = false, filterTransactionPool: boolean = false): Promise<IMempoolResult> {
    return (await this.rpc!.getMempoolEntriesByAddresses({
      addresses: [walletAddress],
      includeOrphanPool,
      filterTransactionPool,
    })) as any as IMempoolResult;
  }


  getContext(): UtxoContext | undefined {
    return this.context;
  }

  private async balanceEventHandler(event: BalanceEvent) {
      this.walletBalanceStateSignal.set(event.data.balance);

      console.log('update balance', event.data.balance);

      if (this.waitForOutgoingUtxoPromise && event.data.balance?.outgoing && event.data.balance?.outgoing > 0) {
        this.resolveAndClearWaitForOutgoingUtxoPromise!();
      }
  }

  private resolveAndClearWaitForOutgoingUtxoPromise() {
    this.waitForOutgoingUtxoResolve!();

    clearTimeout(this.waitForOutgoingUtxoTimeout);
    this.waitForOutgoingUtxoPromise = undefined;
    this.waitForOutgoingUtxoResolve = undefined;
    this.waitForOutgoingUtxoTimeout = undefined;
  }

  private async processorEventListener() {
    if (this.processorEventListenerTimoutReached) {
      return;
    }

    clearTimeout(this.processorEventListenerTimeout);

    try {
      await this.context!.clear();
      await this.context!.trackAddresses([this.publicAddress]);
      this.processorEventListenerResolve!();
    } catch (error) {
      this.processorEventListenerReject!(error);
    }
  }

  private async registerEventHandlers() {
    if (this.processorEventListenerPromise) {
      throw new Error('This object can be used only once');
    }


    await this.registerProcessor();
  }

  async dispose(): Promise<void> {
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
  }

  getUtxoBalanceStateSignal() {
    return this.walletBalanceStateSignal.asReadonly();
  }

  async waitForOutgoingUtxo() {
    this.waitForOutgoingUtxoPromise = new Promise((resolve) => {
      this.waitForOutgoingUtxoResolve = resolve;
    })

    this.waitForOutgoingUtxoTimeout = setTimeout(() => {
      this.resolveAndClearWaitForOutgoingUtxoPromise();
    }, WAIT_TIMEOUT);

    console.log('waitForOutgoingUtxo signal balance', this.walletBalanceStateSignal());
    if (this.walletBalanceStateSignal() && this.walletBalanceStateSignal()!.outgoing > 0n) {
      this.resolveAndClearWaitForOutgoingUtxoPromise();
      return;
    }

    return await this.waitForOutgoingUtxoPromise;
  }
}
