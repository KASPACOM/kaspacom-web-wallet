import { Injectable, inject } from '@angular/core';
import {
  EIP1193ProviderRequestActionResult,
  EIP1193RequestParams,
  EIP1193RequestPayload,
  EIP1193RequestType,
  ERROR_CODES,
  WalletActionResultType,
} from '@kaspacom/wallet-messages';
import { AppWallet } from '../../classes/AppWallet';
import { WalletActionResultWithError } from '../../types/wallet-action-result';
import { EtherService } from './ether.service';
import { createEIP1193Response } from './create-eip-1193-response';
import { ethers, FeeData, TransactionRequest } from 'ethers';
import { EthereumWalletChainManager } from './etherium-wallet-chain.manager';
import { MINIMAL_AMOUNT_TO_SEND } from '../kaspa-netwrok-services/kaspa-network-actions.service';

@Injectable({
  providedIn: 'root',
})
export class EthereumHandleActionRequestService {
  private readonly etherService = inject(EtherService);
  private readonly ethereumWalletChainManager = inject(
    EthereumWalletChainManager,
  );

  protected actionToFunctionMap: {
    [K in EIP1193RequestType]?: (
      action: EIP1193RequestPayload<K>,
      wallet: AppWallet,
    ) => Promise<WalletActionResultWithError>;
  } = {
    [EIP1193RequestType.SEND_TRANSACTION]:
      this.handleSendTransactionRequest.bind(this),
    [EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN]:
      this.handleWalletSwitchEthereumChainRequest.bind(this),
    [EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN]:
      this.handleWalletAddEthereumChainRequest.bind(this),
  };

  getSupportedActions(): EIP1193RequestType[] {
    return Object.keys(this.actionToFunctionMap) as EIP1193RequestType[];
  }

  isActionSupported(action: EIP1193RequestType): boolean {
    return this.actionToFunctionMap[action] !== undefined;
  }

  isKasAction(action: EIP1193RequestType): boolean {
    return action === EIP1193RequestType.KAS_SEND_TRANSACTION;
  }

  async doEIP1193ProviderRequest<T extends EIP1193RequestType>(
    action: EIP1193RequestPayload<T>,
    wallet: AppWallet,
  ): Promise<WalletActionResultWithError> {
    const handler = this.actionToFunctionMap[action.method];
    if (!handler) {
      return {
        success: false,
        errorCode: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
      };
    }

    return await handler(action, wallet);
  }

  normalizeFeeData(fee: FeeData): {
    type?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  } {
    const gasPrice = fee.gasPrice ?? null;
    const maxFee = fee.maxFeePerGas ?? null;
    const maxPriority = fee.maxPriorityFeePerGas ?? null;

    // ---- Case 1: Proper EIP-1559 chain ----
    if (
      maxFee != null &&
      maxPriority != null &&
      gasPrice != null &&
      maxFee >= gasPrice
    ) {
      return {
        type: 2,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriority,
      };
    }

    // ---- Case 2: Broken EIP-1559 (your case) ----
    if (gasPrice != null) {
      return {
        type: 0, // force legacy
        gasPrice,
      };
    }

    // ---- Case 3: Last resort fallback ----
    const fallbackGasPrice = 2_000_000_000n; // 2 gwei safe default

    return {
      type: 0,
      gasPrice: fallbackGasPrice,
    };
  }

  applyFeesSafely(
    tx: ethers.TransactionRequest,
    fees: {
      type?: number;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    },
  ) {
    if (fees.type === 0) {
      // On chains normalized to legacy, the approval UI may still have
      // written the user's selected fee as maxFeePerGas — capture it
      // before we strip EIP-1559 fields so the selection isn't lost.
      const userSelectedPrice = tx.gasPrice ?? tx.maxFeePerGas;

      delete tx.maxFeePerGas;
      delete tx.maxPriorityFeePerGas;
      delete tx.accessList;

      tx.type = 0;
      tx.gasPrice = userSelectedPrice ?? fees.gasPrice;
    } else {
      // EIP-1559 tx → REMOVE legacy field
      delete tx.gasPrice;

      tx.type = 2;
      // Preserve user-selected EIP-1559 fees if already set on the tx
      if (tx.maxFeePerGas == null) {
        tx.maxFeePerGas = fees.maxFeePerGas;
      }
      if (tx.maxPriorityFeePerGas == null) {
        tx.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
      }
    }
  }

  async handleSendTransactionRequest(
    action: EIP1193RequestPayload<EIP1193RequestType.SEND_TRANSACTION>,
    wallet: AppWallet,
  ): Promise<WalletActionResultWithError> {
    const provider = wallet.getL2Provider()?.getProvider();
    if (!provider) {
      throw new Error('No L2 provider');
    }

    // 1. Read raw fee data
    const feeData = await provider.getFeeData();

    // 2. Normalize it (CRITICAL)
    const normalizedFees = this.normalizeFeeData(feeData);

    const l2Wallet: ethers.Wallet = (await wallet.getL2Wallet())!;
    const l2Transaction = await this.etherService.createTransactionAndPopulate(
      action.params[0] as TransactionRequest,
      l2Wallet,
    );
    this.applyFeesSafely(l2Transaction, normalizedFees);
    const signedTransactionString = await this.etherService.signTransaction(
      l2Transaction,
      l2Wallet,
    );
    const transactionHash = await this.etherService.sendTransactionToL2(
      wallet.getL2Provider()!,
      signedTransactionString,
    );

    return {
      success: true,
      result: {
        type: WalletActionResultType.EIP1193ProviderRequest,
        performedByWallet: wallet.getIdWithAccount(),
        requestData: action,
        eip1193Response:
          createEIP1193Response<EIP1193RequestType.SEND_TRANSACTION>(
            transactionHash,
          ),
      } as EIP1193ProviderRequestActionResult<EIP1193RequestType.SEND_TRANSACTION>,
    };
  }

  async handleWalletSwitchEthereumChainRequest(
    action: EIP1193RequestPayload<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>,
    wallet: AppWallet,
  ): Promise<WalletActionResultWithError> {
    await this.ethereumWalletChainManager.setCurrentChain(
      action.params[0].chainId,
    );

    return {
      success: true,
      result: {
        type: WalletActionResultType.EIP1193ProviderRequest,
        performedByWallet: wallet.getIdWithAccount(),
        requestData: action,
        eip1193Response:
          createEIP1193Response<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>(
            null,
          ),
      } as EIP1193ProviderRequestActionResult<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>,
    };
  }

  async handleWalletAddEthereumChainRequest(
    action: EIP1193RequestPayload<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>,
    wallet: AppWallet,
  ): Promise<WalletActionResultWithError> {
    if (
      !action.params[0] ||
      !action.params[0].chainId ||
      !action.params[0].chainName ||
      !action.params[0].rpcUrls ||
      !action.params[0].nativeCurrency
    ) {
      return {
        success: false,
        errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
      };
    }

    if (
      !this.ethereumWalletChainManager.getAllChainsByChainId()[
        action.params[0].chainId
      ]
    ) {
      this.ethereumWalletChainManager.addChain(action.params[0]);
    }

    return {
      success: true,
      result: {
        type: WalletActionResultType.EIP1193ProviderRequest,
        performedByWallet: wallet.getIdWithAccount(),
        requestData: action,
        eip1193Response:
          createEIP1193Response<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>(
            null,
          ),
      } as EIP1193ProviderRequestActionResult<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>,
    };
  }

  async validateEIP1193ProviderRequestAction<T extends EIP1193RequestType>(
    action: EIP1193RequestPayload<T>,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    switch (action.method) {
      case EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN: {
        const params: EIP1193RequestParams[EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN] =
          action.params as EIP1193RequestParams[EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN];
        if (!params || !params[0] || !params[0].chainId) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
          };
        }

        if (
          !this.ethereumWalletChainManager.getAllChainsByChainId()[
            params[0].chainId
          ]
        ) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.EIP1193.CHAIN_NOT_ADDED,
          };
        }
        return { isValidated: true };
      }

      case EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN: {
        const params: EIP1193RequestParams[EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN] =
          action.params as EIP1193RequestParams[EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN];
        if (
          !params ||
          !params[0] ||
          !params[0].chainId ||
          !params[0].chainName ||
          !params[0].rpcUrls ||
          !params[0].nativeCurrency
        ) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
          };
        }
        return { isValidated: true };
      }

      case EIP1193RequestType.KAS_SEND_TRANSACTION: {
        const params: EIP1193RequestParams[EIP1193RequestType.KAS_SEND_TRANSACTION] =
          action.params as EIP1193RequestParams[EIP1193RequestType.KAS_SEND_TRANSACTION];
        if (!params || !params[0]) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
          };
        }

        const ethTransaction = params[0];
        const kasTransaction = params[1];

        let minimalAmount: bigint =
          kasTransaction?.outputs?.reduce(
            (acc, output) => acc + BigInt(output.amount),
            0n,
          ) || MINIMAL_AMOUNT_TO_SEND;

        if (!(minimalAmount && minimalAmount > MINIMAL_AMOUNT_TO_SEND)) {
          minimalAmount = MINIMAL_AMOUNT_TO_SEND;
        }

        const currentBalance =
          wallet.getCurrentWalletStateBalanceSignalValue()?.mature || 0n;

        if (currentBalance < minimalAmount) {
          return {
            isValidated: false,
            errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
          };
        }
        return { isValidated: true };
      }
    }

    return {
      isValidated: true,
    };
  }
}
