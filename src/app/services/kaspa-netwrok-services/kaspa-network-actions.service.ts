import { KaspaNetworkTransactionsManagerService } from './kaspa-network-transactions-manager.service';
import {
  IFeeEstimate,
  IPaymentOutput,
  Mnemonic,
  PrivateKey,
  XPrv,
} from '../../../../public/kaspa/kaspa';
import { Injectable, Signal } from '@angular/core';
import { DEFAULT_DERIVED_PATH, ERROR_CODES } from '../../config/consts';
import { UtxoProcessorManager } from '../../classes/UtxoProcessorManager';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import {
  BuyKrc20PsktAction,
  Krc20Action,
  SignMessage,
  TransferKasAction,
  WalletAction,
  WalletActionType,
} from '../../types/wallet-action';
import { AppWallet } from '../../classes/AppWallet';
import {
  BuyKrc20PsktActionResult,
  CompoundUtxosActionResult,
  KasTransferActionResult,
  Krc20ActionResult,
  SignedMessageActionResult,
  WalletActionResult,
  WalletActionResultType,
} from '../../types/wallet-action-result';
import {
  KASPA_AMOUNT_FOR_KRC20_ACTION,
  Krc20OperationDataService,
} from './krc20-operation-data.service';
import { UnfinishedKrc20Action } from '../../types/kaspa-network/unfinished-krc20-action.interface';
import {
  KRC20OperationDataInterface,
  KRC20OperationType,
} from '../../types/kaspa-network/krc20-operations-data.interface';
import { PsktTransaction } from '../../types/kaspa-network/pskt-transaction.interface';

const MINIMAL_TRANSACTION_MASS = 10000n;
export const MINIMAL_AMOUNT_TO_SEND = 20000000n;
export const MAX_TRANSACTION_FEE = 20000n;

const ESTIMATED_REVEAL_ACTION = 1715n;
const ESTIMATED_LIST_REVEAL_ACTION = 3274n;
@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkActionsService {
  constructor(
    private readonly transactionsManager: KaspaNetworkTransactionsManagerService,
    private readonly krc20OperationDataService: Krc20OperationDataService
  ) {}

  async connectAndDo<T>(
    fn: () => Promise<T>,
    attempts: number = Infinity
  ): Promise<T> {
    return await this.transactionsManager.connectAndDo<T>(fn, attempts);
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.transactionsManager.getConnectionStatusSignal();
  }

  async getWalletBalanceAndUtxos(walletAddres: string) {
    return await this.transactionsManager.getWalletTotalBalanceAndUtxos(
      walletAddres
    );
  }

  kaspaToSompiFromNumber(value: number): bigint {
    return BigInt(
      Math.round(value * 1e8).toLocaleString('fullwide', { useGrouping: false })
    );
  }

  sompiToNumber(value: bigint): number {
    return Number(value) / 1e8;
  }

  convertPrivateKeyToAddress(privateKey: string): string {
    return this.transactionsManager.convertPrivateKeyToAddress(privateKey);
  }

  validatePrivateKey(privateKey: string) {
    try {
      new PrivateKey(privateKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  getPrivateKeyFromMnemonic(
    mnemonicWords: string,
    derivedPath: string = DEFAULT_DERIVED_PATH,
    password?: string
  ): string | null {
    const isValid = Mnemonic.validate(mnemonicWords);

    if (!isValid) {
      return null;
    }

    const mnemonic = new Mnemonic(mnemonicWords);

    const seed = mnemonic.toSeed(password);
    const xprv = new XPrv(seed);

    if (derivedPath) {
      return xprv.derivePath(derivedPath).toPrivateKey().toString();
    }

    return xprv.privateKey;
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string
  ): string | null {
    const privateKey = this.getPrivateKeyFromMnemonic(
      mnemonic,
      DEFAULT_DERIVED_PATH,
      password
    );
    return privateKey ? this.convertPrivateKeyToAddress(privateKey) : null;
  }

  generateMnemonic(wordsCount: number): string {
    return Mnemonic.random(wordsCount).phrase;
  }

  async initUtxoProcessorManager(
    address: string,
    onBalanceUpdate: () => Promise<any>
  ): Promise<UtxoProcessorManager> {
    return await this.transactionsManager.initUtxoProcessorManager(
      address,
      onBalanceUpdate
    );
  }

  // Should be synced with doWalletAction
  async estimateWalletActionMass(
    action: WalletAction,
    wallet: AppWallet
  ): Promise<bigint[]> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      const actionData = action.data as TransferKasAction;
      const payments: IPaymentOutput[] = [
        {
          address: actionData.to,
          amount: actionData.amount,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          actionData.sendAll,
          async () => {},
          true
        );

      if (!result.success) {
        throw new Error('Failed to estimate transaction mass');
      }

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type == WalletActionType.COMPOUND_UTXOS) {
      await wallet.getUtxoProcessorManager()?.waitForPendingUtxoToFinish();

      const payments: IPaymentOutput[] = [
        {
          address: wallet.getAddress(),
          amount: 0n,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          true,
          async () => {},
          true
        );

      return result.result!.transactions.map((t) => t.mass);
    }

    if (action.type === WalletActionType.KRC20_ACTION) {
      const actionData = action.data as Krc20Action;

      const result =
        await this.transactionsManager.doKrc20ActionTransactionWithUtxoProcessor(
          wallet,
          actionData.operationData,
          action.priorityFee || 0n,
          this.krc20OperationDataService.getPriceForOperation(
            actionData.operationData.op
          ),
          async () => {},
          actionData.revealOnly,
          actionData.transactionId,
          actionData.psktData,
          true,
        );

      if (!result.success) {
        throw new Error('Failed to estimate transaction mass');
      }

      return [
        ...(result.result!.commit?.transactions.map((t) => t.mass) || []),
        actionData.operationData.op == KRC20OperationType.LIST ? ESTIMATED_LIST_REVEAL_ACTION : ESTIMATED_REVEAL_ACTION,
      ];
    }

    if (action.type == WalletActionType.BUY_KRC20_PSKT) {
      const result =
        await this.transactionsManager.completePsktTransactionForSendOperation(
          wallet,
          (action.data as BuyKrc20PsktAction).psktTransactionJson,
          action.priorityFee || 0n,
          true
        );

      if (!result.transactionFee) {
        throw new Error('Failed to estimate transaction mass');
      }

      return [result.transactionFee];
    }

    throw new Error('No such action type');
  }

  // Shoult be synced with estimateWalletActionMass
  async doWalletAction(
    action: WalletAction,
    wallet: AppWallet,
    notifyUpdate: (transactionId: string) => Promise<any>
  ): Promise<{
    success: boolean;
    errorCode?: number;
    result?: WalletActionResult;
  }> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      const actionData = action.data as TransferKasAction;
      const payments: IPaymentOutput[] = [
        {
          address: actionData.to,
          amount: actionData.amount,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          actionData.sendAll,
          notifyUpdate
        );

      const actionResult: KasTransferActionResult = {
        amount: actionData.amount,
        to: actionData.to,
        sendAll: actionData.sendAll,
        transactionId: result.result!.summary.finalTransactionId!,
        performedByWallet: wallet.getAddress(),
        type: WalletActionResultType.KasTransfer,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type == WalletActionType.COMPOUND_UTXOS) {
      await wallet.getUtxoProcessorManager()?.waitForPendingUtxoToFinish();

      if ((wallet.getBalanceSignal()()?.utxoEntries.length || 0) < 2) {
        return {
          success: false,
          errorCode: ERROR_CODES.WALLET_ACTION.NO_UTXOS_TO_COMPOUND,
        };
      }

      const payments: IPaymentOutput[] = [
        {
          address: wallet.getAddress(),
          amount: 0n,
        },
      ];

      const result =
        await this.transactionsManager.doKaspaTransferTransactionWithUtxoProcessor(
          wallet,
          payments,
          action.priorityFee || 0n,
          true,
          notifyUpdate
        );

      const actionResult: CompoundUtxosActionResult = {
        transactionId: result.result!.summary.finalTransactionId!,
        performedByWallet: wallet.getAddress(),
        type: WalletActionResultType.CompoundUtxos,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type === WalletActionType.KRC20_ACTION) {
      const actionData = action.data as Krc20Action;

      const result =
        await this.transactionsManager.doKrc20ActionTransactionWithUtxoProcessor(
          wallet,
          actionData.operationData,
          action.priorityFee || 0n,
          this.krc20OperationDataService.getPriceForOperation(
            actionData.operationData.op
          ),
          notifyUpdate,
          actionData.revealOnly,
          actionData.transactionId,
          actionData.psktData
        );

      if (!result.success) {
        console.error('Failed do KRC20 action', result);
        return {
          success: false,
          errorCode: result.errorCode,
        };
      }

      const actionResult: Krc20ActionResult = {
        type: WalletActionResultType.Krc20Action,
        commitTransactionId: result.result!.commit?.summary.finalTransactionId!,
        revealTransactionId: result.result!.reveal!.summary.finalTransactionId!,
        performedByWallet: wallet.getAddress(),
        ticker: actionData.operationData.tick,
        operationData: actionData.operationData,
        psktData: actionData.psktData,
        isCancel: actionData.isCancel,
        amount: actionData.amount,
        psktTransaction: result.result?.pskt
          ? result.result?.pskt.serializeToSafeJSON()
          : undefined,
      };

      return {
        success: true,
        result: actionResult,
      };
    }

    if (action.type == WalletActionType.BUY_KRC20_PSKT) {
      const result =
        await this.transactionsManager.completePsktTransactionForSendOperation(
          wallet,
          (action.data as BuyKrc20PsktAction).psktTransactionJson,
          action.priorityFee || 0n
        );

      const resultData: BuyKrc20PsktActionResult = {
        type: WalletActionResultType.BuyKrc20Pskt,
        psktTransactionJson: result.psktTransaction,
        transactionId: result.transactionId,
        performedByWallet: wallet.getAddress(),
      };

      return {
        success: true,
        result: resultData,
      };
    }

    if (action.type == WalletActionType.SIGN_MESSAGE) {
      const result = await this.transactionsManager.signMessage(wallet.getPrivateKey(), (action.data as SignMessage).message)

      const resultData: SignedMessageActionResult = {
        type: WalletActionResultType.MessageSigning,
        performedByWallet: wallet.getAddress(), 
        originalMessage: (action.data as SignMessage).message,
        signedMessage: result.signedMessage,
        publicKey: result.publickey,
      };

      return {
        success: true,
        result: resultData,
      };
    }

    return {
      success: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };
  }

  async getMinimalRequiredAmountForAction(
    action: WalletAction
  ): Promise<bigint> {
    if (action.type === WalletActionType.TRANSFER_KAS) {
      return (
        (action.data as TransferKasAction).amount +
        (action.priorityFee || 0n) +
        MINIMAL_TRANSACTION_MASS
      );
    }

    if (action.type === WalletActionType.KRC20_ACTION) {
      return (
        (action.priorityFee || 0n) * 2n +
        MINIMAL_TRANSACTION_MASS * 2n +
        KASPA_AMOUNT_FOR_KRC20_ACTION +
        this.krc20OperationDataService.getPriceForOperation(
          (action.data as Krc20Action).operationData.op
        )
      );
    }

    if (action.type === WalletActionType.COMPOUND_UTXOS) {
      return (action.priorityFee || 0n) + MINIMAL_AMOUNT_TO_SEND;
    }

    if (action.type === WalletActionType.BUY_KRC20_PSKT) {
      const data = action.data as BuyKrc20PsktAction;
      const pskt: PsktTransaction = JSON.parse(data.psktTransactionJson);

      const totalOutputs = pskt.outputs.reduce(
        (acc, curr) => acc + BigInt(curr.value),
        0n
      );

      return (action.priorityFee || 0n) + totalOutputs + MINIMAL_AMOUNT_TO_SEND;
    }

    throw new Error('Invalid action type');
  }

  async getWalletUnfinishedActions(
    wallet: AppWallet
  ): Promise<UnfinishedKrc20Action | undefined> {
    return await this.transactionsManager.checkUnfinishedTransactionsForUserAndGetOne(
      wallet
    );
  }

  async doesUnfinishedActionHasKasInScriptWallet(
    wallet: AppWallet,
    action: KRC20OperationDataInterface
  ) {
    return this.transactionsManager.doesUnfinishedActionHasKasInScriptWallet(
      wallet,
      action
    );
  }

  getWalletAddressFromScriptPublicKey(scriptPublicKey: string): string {
    return this.transactionsManager.getWalletAddressFromScriptPublicKey(
      scriptPublicKey
    );
  }

  async getEstimateFeeRates(): Promise<IFeeEstimate> {
    return await this.transactionsManager.getEstimateFeeRates();
  }
}
