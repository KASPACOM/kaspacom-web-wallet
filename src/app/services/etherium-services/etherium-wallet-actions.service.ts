import { Injectable, inject } from '@angular/core';
import { AppWallet } from '../../classes/AppWallet';
import {
  EIP1193RequestPayload,
  EIP1193RequestType,
  ERROR_CODES,
  EIP1193ProviderResponse,
  EIP1193ProviderEventEnum,
  EIP1193KaspaComWalletProviderEvent,
  ERROR_CODES_MESSAGES,
  EIP1193ProviderRequestActionResult,
} from '@kaspacom/wallet-messages';
import { EthereumWalletChainManager } from './etherium-wallet-chain.manager';
import { WalletService } from '../wallet.service';
import { WalletActionService } from '../wallet-action.service';
import { createEIP1193Response } from './create-eip-1193-response';
import { EthereumHandleActionRequestService } from './etherium-handle-action-request.service';
import { AllowedApplicationsService } from '../communication-service/allowed-applications.service';
import { WALLET_APP_ID } from '../../config/consts';
import { ethers, TransactionRequest } from 'ethers';

@Injectable({
  providedIn: 'root',
})
export class EthereumWalletActionsService {
  private readonly ethereumWalletChainManager = inject(
    EthereumWalletChainManager,
  );
  private readonly ethereumHandleActionRequestService = inject(
    EthereumHandleActionRequestService,
  );
  private readonly walletService = inject(WalletService);
  private readonly walletActionsService = inject(WalletActionService);
  private readonly allowedApplicationsService = inject(
    AllowedApplicationsService,
  );

  async handleRequest<T extends EIP1193RequestType>(
    request: EIP1193RequestPayload<T>,
    onActionApproval: undefined | (() => Promise<void>) = undefined,
    notFromIframe: boolean = false,
    appId?: string,
  ): Promise<EIP1193ProviderResponse<T>> {
    try {
      if (!this.ethereumWalletChainManager.getCurrentChainSignal()()) {
        this.ethereumWalletChainManager.setCurrentChain(
          Object.values(
            this.ethereumWalletChainManager.getAllChainsByChainId(),
          )[0].chainId,
        );
        this.walletService.setL2Display(true);
      }

      if (
        this.ethereumHandleActionRequestService.isActionSupported(
          request.method,
        ) ||
        this.ethereumHandleActionRequestService.isKasAction(request.method)
      ) {
        const walletResponse =
          await this.walletActionsService.validateAndDoActionAfterApproval(
            this.walletActionsService.createEIP1193Action(request),
            !notFromIframe,
            async () => {
              await onActionApproval?.();
            },
          );

        if (!walletResponse.success) {
          return createEIP1193Response<T>(undefined, {
            code:
              walletResponse.errorCode ?? ERROR_CODES.EIP1193.INTERNAL_ERROR,
            message:
              ERROR_CODES_MESSAGES[
                walletResponse.errorCode ?? ERROR_CODES.EIP1193.INTERNAL_ERROR
              ] ?? 'Unknown error',
          });
        }

        return (walletResponse.result as EIP1193ProviderRequestActionResult<T>)
          .eip1193Response;
      }

      switch (request.method) {
        case EIP1193RequestType.REQUEST_ACCOUNTS:
        case EIP1193RequestType.GET_ACCOUNTS:
          // Return the current wallet address
          const allAccounts =
            await this.getAllApprovedAccountsAndOrderThem(appId);

          return createEIP1193Response<T>(allAccounts);
        case EIP1193RequestType.GET_BALANCE:
          const walletAddress = request.params?.[0] as string;

          if (!walletAddress) {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
              message: 'Invalid wallet address',
            });
          }

          if (request.params?.[1] !== 'latest') {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
              message: 'Block number not supported',
            });
          }

          const balance = await this.ethereumWalletChainManager
            .getCurrentWalletProvider()!
            .getWalletBalance(walletAddress);
          if (!balance && balance !== 0n) {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
              message: 'Failed to get balance',
            });
          }

          // convert bigint to hex
          return createEIP1193Response<T>(`0x${balance.toString(16)}`);
        case EIP1193RequestType.GET_CHAIN_ID:
          return createEIP1193Response<T>(
            this.ethereumWalletChainManager.getCurrentChainSignal()()!,
          );
        case EIP1193RequestType.ETH_CALL:
          const ethCalltransaction = request.params?.[0];
          const blockTag = request.params?.[1] as string | undefined;

          if (!ethCalltransaction) {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
              message: 'Transaction object is required',
            });
          }

          const callResult = await this.ethereumWalletChainManager
            .getCurrentWalletProvider()!
            .ethCall(ethCalltransaction, blockTag);
          return createEIP1193Response<T>(callResult);

        case EIP1193RequestType.GET_BLOCK_NUMBER:
          const blockNumber = await this.ethereumWalletChainManager
            .getCurrentWalletProvider()!
            .ethBlockNumber();
          return createEIP1193Response<T>(blockNumber);

        case EIP1193RequestType.GET_ESTIMATE_GAS:
          const estimateGasTransaction = request.params?.[0] as any;
          const provider =
            this.ethereumWalletChainManager.getCurrentWalletProvider()!;
          const wallet = await this.walletService
            .getCurrentWallet()
            ?.getL2Wallet();

          const gas = wallet
            ? await provider.estimateGas(
                wallet,
                estimateGasTransaction as TransactionRequest,
              )
            : BigInt(await provider.ethEstimateGas(estimateGasTransaction));
          return createEIP1193Response<T>(ethers.toQuantity(gas));

        case EIP1193RequestType.GET_TRANSACTION_BY_HASH:
          const txHash = request.params?.[0] as string;

          if (!txHash) {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
              message: 'Transaction hash is required',
            });
          }

          const tx = await this.ethereumWalletChainManager
            .getCurrentWalletProvider()!
            .ethGetTransactionByHash(txHash);
          return createEIP1193Response<T>(tx);

        case EIP1193RequestType.GET_TRANSACTION_RECEIPT:
          const receiptTxHash = request.params?.[0] as string;

          if (!receiptTxHash) {
            return createEIP1193Response<T>(undefined, {
              code: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
              message: 'Transaction hash is required',
            });
          }

          const receipt = await this.ethereumWalletChainManager
            .getCurrentWalletProvider()!
            .ethGetTransactionReceipt(receiptTxHash);
          return createEIP1193Response<T>(receipt);

        default:
          return createEIP1193Response<T>(undefined, {
            code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
            message: `Method ${request.method} not supported`,
          });
      }
    } catch (error) {
      return createEIP1193Response<T>(undefined, {
        code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
        message: 'Internal error',
      });
    }
  }

  async getEventData(
    event: EIP1193ProviderEventEnum,
    data?: unknown,
    appId?: string,
  ): Promise<EIP1193KaspaComWalletProviderEvent> {
    switch (event) {
      case EIP1193ProviderEventEnum.CONNECT:
        return {
          type: EIP1193ProviderEventEnum.CONNECT,
          data: {
            chainId: parseInt(
              this.ethereumWalletChainManager
                .getCurrentChainSignal()()
                ?.slice(2) || '0',
              16,
            ),
          },
        };
      case EIP1193ProviderEventEnum.DISCONNECT:
        return {
          type: EIP1193ProviderEventEnum.DISCONNECT,
          data: new Error('Provider disconnected'),
        };
      case EIP1193ProviderEventEnum.CHAIN_CHANGED:
        return {
          type: EIP1193ProviderEventEnum.CHAIN_CHANGED,
          data:
            this.ethereumWalletChainManager.getCurrentChainSignal()() || '0x0',
        };
      case EIP1193ProviderEventEnum.ACCOUNTS_CHANGED: {
        return {
          type: EIP1193ProviderEventEnum.ACCOUNTS_CHANGED,
          data: await this.getAllApprovedAccountsAndOrderThem(appId!),
        };
      }
      case EIP1193ProviderEventEnum.MESSAGE:
        return {
          type: EIP1193ProviderEventEnum.MESSAGE,
          data: {
            type: EIP1193ProviderEventEnum.MESSAGE,
            data: data,
          },
        };
      default:
        throw new Error(`Unsupported event type: ${event}`);
    }
  }

  private async getAllApprovedAccountsAndOrderThem(
    appId?: string,
  ): Promise<string[]> {
    const wallets: AppWallet[] | undefined =
      this.walletService.getAllWallets()();

    if (
      !wallets ||
      wallets.length === 0 ||
      !appId ||
      appId.trim().length == 0
    ) {
      return [];
    }

    // Filter wallets to only include those used by allowed applications
    const filteredWallets =
      appId == WALLET_APP_ID
        ? wallets
        : wallets.filter((wallet) => {
            return this.allowedApplicationsService.isAllowedApplication(
              appId,
              wallet.getIdWithAccount(),
            );
          });

    if (filteredWallets.length === 0) {
      return [];
    }

    const allAccounts = filteredWallets.map((wallet) =>
      wallet.getL2WalletAddress(),
    );

    // put current wallet address first
    const currentWalletAddress = this.walletService
      .getCurrentWallet()!
      .getL2WalletAddress();
    const currentWalletIndex = allAccounts.findIndex(
      (account) => account === currentWalletAddress,
    );
    if (currentWalletAddress && currentWalletIndex !== -1) {
      allAccounts.splice(currentWalletIndex, 1);
      allAccounts.unshift(currentWalletAddress);
    }

    return allAccounts;
  }
}
