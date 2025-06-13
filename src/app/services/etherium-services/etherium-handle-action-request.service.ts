import { Injectable } from "@angular/core";
import { EIP1193ProviderRequestActionResult, EIP1193RequestParams, EIP1193RequestPayload, EIP1193RequestType, ERROR_CODES, WalletActionResultType } from "@kaspacom/wallet-messages";
import { AppWallet } from "../../classes/AppWallet";
import { WalletActionResultWithError } from "../../types/wallet-action-result";
import { EtherService } from "./ether.service";
import { createEIP1193Response } from "./create-eip-1193-response";
import { ethers, TransactionRequest } from "ethers";
import { EthereumWalletChainManager } from "./etherium-wallet-chain.manager";
import { MINIMAL_AMOUNT_TO_SEND } from "../kaspa-netwrok-services/kaspa-network-actions.service";

@Injectable({
    providedIn: 'root',
})
export class EthereumHandleActionRequestService {
    protected actionToFunctionMap: {
        [K in EIP1193RequestType]?: (action: EIP1193RequestPayload<K>, wallet: AppWallet) => Promise<WalletActionResultWithError>
    } = {
            [EIP1193RequestType.SEND_TRANSACTION]: this.handleSendTransactionRequest.bind(this),
            [EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN]: this.handleWalletSwitchEthereumChainRequest.bind(this),
            [EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN]: this.handleWalletAddEthereumChainRequest.bind(this),
        }
    

    constructor(
        private readonly etherService: EtherService,
        private readonly ethereumWalletChainManager: EthereumWalletChainManager,
    ) { }

    getSupportedActions(): EIP1193RequestType[] {
        return Object.keys(this.actionToFunctionMap) as EIP1193RequestType[];
    }

    isActionSupported(action: EIP1193RequestType): boolean {
        return this.actionToFunctionMap[action] !== undefined;
    }

    isKasAction(action: EIP1193RequestType): boolean {
        return action === EIP1193RequestType.KAS_SEND_TRANSACTION;
    }

    async doEIP1193ProviderRequest<T extends EIP1193RequestType>(action: EIP1193RequestPayload<T>, wallet: AppWallet): Promise<WalletActionResultWithError> {
        const handler = this.actionToFunctionMap[action.method];
        if (!handler) {
            return {
                success: false,
                errorCode: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
            };
        }

        return await handler(action, wallet);
    }

    async handleSendTransactionRequest(action: EIP1193RequestPayload<EIP1193RequestType.SEND_TRANSACTION>, wallet: AppWallet): Promise<WalletActionResultWithError> {
        const l2Wallet: ethers.Wallet = (await wallet.getL2Wallet())!;
        const l2Transaction = await this.etherService.createTransactionAndPopulate(action.params[0] as TransactionRequest, l2Wallet);

        const signedTransactionString = await this.etherService.signTransaction(l2Transaction, l2Wallet);
        const transactionHash = await this.etherService.sendTransactionToL2(wallet.getL2Provider()!, signedTransactionString);

        return {
            success: true,
            result: {
                type: WalletActionResultType.EIP1193ProviderRequest,
                performedByWallet: wallet.getIdWithAccount(),
                requestData: action,
                eip1193Response: createEIP1193Response<EIP1193RequestType.SEND_TRANSACTION>(transactionHash)
            } as EIP1193ProviderRequestActionResult<EIP1193RequestType.SEND_TRANSACTION>
        }

    }

    async handleWalletSwitchEthereumChainRequest(action: EIP1193RequestPayload<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>, wallet: AppWallet): Promise<WalletActionResultWithError> {
        await this.ethereumWalletChainManager.setCurrentChain(action.params[0].chainId);

        return {
            success: true,
            result: {
                type: WalletActionResultType.EIP1193ProviderRequest,
                performedByWallet: wallet.getIdWithAccount(),
                requestData: action,
                eip1193Response: createEIP1193Response<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>(null)
            } as EIP1193ProviderRequestActionResult<EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN>
        }
    }

    async handleWalletAddEthereumChainRequest(action: EIP1193RequestPayload<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>, wallet: AppWallet): Promise<WalletActionResultWithError> {
        if (!action.params[0] || !action.params[0].chainId || !action.params[0].chainName || !action.params[0].rpcUrls || !action.params[0].nativeCurrency) {
            return {
                success: false,
                errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
            };
        }

        if (!this.ethereumWalletChainManager.getAllChainsByChainId()[action.params[0].chainId]) {
            this.ethereumWalletChainManager.addChain(action.params[0]);
        }

        return {
            success: true,
            result: {
                type: WalletActionResultType.EIP1193ProviderRequest,
                performedByWallet: wallet.getIdWithAccount(),
                requestData: action,
                eip1193Response: createEIP1193Response<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>(null)
            } as EIP1193ProviderRequestActionResult<EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN>
        }
    }

    async validateEIP1193ProviderRequestAction<T extends EIP1193RequestType>(
        action: EIP1193RequestPayload<T>,
        wallet: AppWallet
    ): Promise<{ isValidated: boolean; errorCode?: number }> {
        switch (action.method) {
            case EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN: {
                const params: EIP1193RequestParams[EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN] = action.params as EIP1193RequestParams[EIP1193RequestType.WALLET_SWITCH_ETHEREUM_CHAIN];
                if (!params || !params[0] || !params[0].chainId) {
                    return {
                        isValidated: false,
                        errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
                    };
                }

                if (!this.ethereumWalletChainManager.getAllChainsByChainId()[params[0].chainId]) {
                    return {
                        isValidated: false,
                        errorCode: ERROR_CODES.EIP1193.CHAIN_NOT_ADDED,
                    };
                }
                return { isValidated: true };
            }

            case EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN: {
                const params: EIP1193RequestParams[EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN] = action.params as EIP1193RequestParams[EIP1193RequestType.WALLET_ADD_ETHEREUM_CHAIN];
                if (!params || !params[0] || !params[0].chainId || !params[0].chainName || !params[0].rpcUrls || !params[0].nativeCurrency) {
                    return {
                        isValidated: false,
                        errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
                    };
                }
                return { isValidated: true };
            }

            case EIP1193RequestType.KAS_SEND_TRANSACTION: {
                const params: EIP1193RequestParams[EIP1193RequestType.KAS_SEND_TRANSACTION] = action.params as EIP1193RequestParams[EIP1193RequestType.KAS_SEND_TRANSACTION];
                if (!params || !params[0]) {
                    return {
                        isValidated: false,
                        errorCode: ERROR_CODES.EIP1193.INVALID_PARAMETERS,
                    }
                }

                const ethTransaction = params[0];
                const kasTransaction = params[1];

                let minimalAmount: bigint = kasTransaction?.outputs?.reduce((acc, output) => acc + BigInt(output.amount), 0n) || MINIMAL_AMOUNT_TO_SEND;


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
