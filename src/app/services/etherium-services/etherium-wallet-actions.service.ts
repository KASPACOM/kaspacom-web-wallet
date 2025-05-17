import { Injectable } from "@angular/core";
import { AppWallet } from "../../classes/AppWallet";
import { EIP1193RequestPayload, EIP1193RequestType, ERROR_CODES, EIP1193ProviderResponse, EIP1193ProviderEventEnum, EIP1193KaspaComWalletProviderEvent, ERROR_CODES_MESSAGES } from "kaspacom-wallet-messages";
import { EthereumWalletChainManager } from "./etherium-wallet-chain.manager";
import { WalletService } from "../wallet.service";
import { WalletActionService } from "../wallet-action.service";
import { createEIP1193Response } from "./create-eip-1193-response";
import { EthereumHandleActionRequestService } from "./etherium-handle-action-request.service";

@Injectable({
    providedIn: 'root',
})
export class EthereumWalletActionsService {

    constructor(
        private readonly ethereumWalletChainManager: EthereumWalletChainManager,
        private readonly ethereumHandleActionRequestService: EthereumHandleActionRequestService,
        private readonly walletService: WalletService,
        private readonly walletActionsService: WalletActionService,
    ) { }

    async handleRequest<T extends EIP1193RequestType>(request: EIP1193RequestPayload<T>, onActionApproval: undefined | (() => Promise<void>) = undefined): Promise<EIP1193ProviderResponse<T>> {

        try {
            if (!this.ethereumWalletChainManager.getCurrentChainSignal()()) {
                this.ethereumWalletChainManager.setCurrentChain(Object.values(this.ethereumWalletChainManager.getAllChainsByChainId())[0].chainId);
            }

            if (this.ethereumHandleActionRequestService.isActionSupported(request.method) || this.ethereumHandleActionRequestService.isKasAction(request.method)) {
                const result = await this.walletActionsService.validateAndDoActionAfterApproval(
                    this.walletActionsService.createEIP1193Action(request),
                    true,
                    async () => { await onActionApproval?.() },
                )

                return createEIP1193Response<T>(result.result, result.success ? undefined : {
                    code: result.errorCode || ERROR_CODES.EIP1193.INTERNAL_ERROR,
                    message: ERROR_CODES_MESSAGES[result.errorCode!] || 'Error while doing action'
                });
            }

            switch (request.method) {
                case EIP1193RequestType.REQUEST_ACCOUNTS:
                    // Return the current wallet address
                    const allAccounts = await this.getAllAccountsAndOrderThem();

                    return createEIP1193Response<T>(allAccounts);
                case EIP1193RequestType.GET_BALANCE:

                    const walletAddress = request.params?.[0] as string;

                    if (!walletAddress) {
                        return createEIP1193Response<T>(undefined, {
                            code: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
                            message: 'Invalid wallet address'
                        });
                    }

                    if (request.params?.[1] !== 'latest') {
                        return createEIP1193Response<T>(undefined, {
                            code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
                            message: 'Block number not supported'
                        });
                    }

                    const balance = await this.ethereumWalletChainManager.getCurrentWalletProvider()!.getWalletBalance(walletAddress);
                    if (!balance) {
                        return createEIP1193Response<T>(undefined, {
                            code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
                            message: 'Failed to get balance'
                        });
                    }

                    // convert bigint to hex
                    return createEIP1193Response<T>(`0x${balance.toString(16)}`);
                case EIP1193RequestType.GET_CHAIN_ID:
                    return createEIP1193Response<T>(this.ethereumWalletChainManager.getCurrentChainSignal()()!);

                default:
                    return createEIP1193Response<T>(undefined, {
                        code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
                        message: `Method ${request.method} not supported`
                    });
            }
        } catch (error) {
            return createEIP1193Response<T>(undefined, {
                code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
                message: 'Internal error'
            });
        }
    }

    async getEventData(event: EIP1193ProviderEventEnum, data?: unknown): Promise<EIP1193KaspaComWalletProviderEvent> {
        switch (event) {
            case EIP1193ProviderEventEnum.CONNECT:
                return {
                    type: EIP1193ProviderEventEnum.CONNECT,
                    data: {
                        chainId: parseInt(this.ethereumWalletChainManager.getCurrentChainSignal()()?.slice(2) || '0', 16)
                    }
                };
            case EIP1193ProviderEventEnum.DISCONNECT:
                return {
                    type: EIP1193ProviderEventEnum.DISCONNECT,
                    data: new Error('Provider disconnected')
                };
            case EIP1193ProviderEventEnum.CHAIN_CHANGED:
                return {
                    type: EIP1193ProviderEventEnum.CHAIN_CHANGED,
                    data: this.ethereumWalletChainManager.getCurrentChainSignal()() || '0x0'
                };
            case EIP1193ProviderEventEnum.ACCOUNTS_CHANGED: {
                return {
                    type: EIP1193ProviderEventEnum.ACCOUNTS_CHANGED,
                    data: await this.getAllAccountsAndOrderThem()
                };
            }
            case EIP1193ProviderEventEnum.MESSAGE:
                return {
                    type: EIP1193ProviderEventEnum.MESSAGE,
                    data: {
                        type: EIP1193ProviderEventEnum.MESSAGE,
                        data: data,
                    }
                };
            default:
                throw new Error(`Unsupported event type: ${event}`);
        }
    }

    private async getAllAccountsAndOrderThem(): Promise<string[]> {
        const wallets: AppWallet[] | undefined = this.walletService.getAllWallets()();

        if (!wallets || wallets.length === 0) {
            return [];
        }

        const allAccounts = await Promise.all(wallets.map(async (wallet: AppWallet) => (await wallet.getL2WalletAddress())!));

        // put current wallet address first
        const currentWalletAddress = await this.walletService.getCurrentWallet()!.getL2WalletAddress();
        const currentWalletIndex = allAccounts.findIndex(account => account === currentWalletAddress);
        if (currentWalletAddress && currentWalletIndex !== -1) {
            allAccounts.splice(currentWalletIndex, 1);
            allAccounts.unshift(currentWalletAddress);
        }

        return allAccounts;
    }
}

