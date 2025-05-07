import { Injectable, signal } from "@angular/core";
import { environment } from "../../environments/environment";
import { LOCAL_STORAGE_KEYS } from "../config/consts";
import { EIP1193ProviderChain, EIP1193ProviderResponse, EIP1193RequestPayload, EIP1193RequestType } from "kaspacom-wallet-messages";
import { WalletService } from "./wallet.service";
import { ERROR_CODES } from 'kaspacom-wallet-messages';
import { AppWallet } from '../classes/AppWallet';
import { BaseEthereumProvider } from "./base-ethereum-provider";

@Injectable({
    providedIn: 'root',
})
export class EthereumWalletService {
    private currentChain = signal<string | undefined>(undefined);
    private currentProvider: BaseEthereumProvider | undefined = undefined;
    protected allChainsByChainId: { [chainId: string]: EIP1193ProviderChain } = {};

    constructor(
        private walletService: WalletService,
    ) {
        this.setAllChainsByChainId();
    }

    public getCurrentChainSignal() {
        return this.currentChain.asReadonly();
    }

    public setCurrentChain(chain: string) {
        console.log('setCurrentChain', chain);
        this.currentChain.set(chain);

        this.setCurrentWalletProviderAndStopOldOne();
    }

    public convertChainIdToHex(chainId: number): string {
        return `0x${chainId.toString(16)}`;
    }
    
    public getCurrentWalletProvider(): BaseEthereumProvider | undefined{
        return this.currentProvider;
    }

    private setCurrentWalletProviderAndStopOldOne(): void {
        if (this.currentProvider) {
            this.currentProvider.disconnect();
            this.currentProvider = undefined;
        }

        const currentChain = this.getCurrentChainSignal()();
        if (!currentChain) {
            throw new Error('No chain selected');
        }

        const chainConfig = this.getAllChainsByChainId()[currentChain];
        if (!chainConfig) {
            throw new Error('Chain not found');
        }
        
        this.currentProvider = new BaseEthereumProvider(chainConfig);
    }


    public getAllChainsByChainId(): { [chainId: string]: EIP1193ProviderChain } {
        return this.allChainsByChainId;
    }

    private setAllChainsByChainId(): void {
        const allChains: EIP1193ProviderChain[] = Object.values(environment.l2Configs).map(config => ({
            chainId: this.convertChainIdToHex(config.chainId),
            chainName: config.name,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: [...config.rpcUrls.default.http],
            blockExplorerUrls: config.blockExplorerUrls || []
        })).concat(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS) || '[]'));

        this.allChainsByChainId = allChains.reduce((acc, chain) => {
            acc[chain.chainId] = chain;
            return acc;
        }, {} as { [chainId: string]: EIP1193ProviderChain });
    }

    public addChain(chain: EIP1193ProviderChain): void {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS, JSON.stringify([...JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS) || '[]'), chain]));
        this.setAllChainsByChainId();
    }

    async handleRequest<T extends EIP1193RequestType>(request: EIP1193RequestPayload<T>): Promise<EIP1193ProviderResponse<T>> {
        try {
            switch (request.method) {
                case EIP1193RequestType.REQUEST_ACCOUNTS:
                    // Return the current wallet address
                    const wallets: AppWallet[] | undefined = this.walletService.getAllWallets()();

                    if (!wallets || wallets.length === 0) {
                        return this.createResponse<T>(undefined, {
                            code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
                            message: 'No wallets found'
                        });
                    }

                    return this.createResponse<T>(await Promise.all(wallets.map(async (wallet: AppWallet) => await wallet.getL2WalletAddress())));
                case 'eth_getBalance':

                    const walletAddress = request.params[0] as string;

                    if (!walletAddress || !this.currentChain()) {
                        return this.createResponse<T>(undefined, {
                            code: ERROR_CODES.EIP1193.UNAUTHORIZED,
                            message: 'No wallet connected'
                        });
                    }

                    const balance = await this.getCurrentWalletProvider()!.getWalletBalance(walletAddress);
                    if (!balance) {
                        return this.createResponse<T>(undefined, {
                            code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
                            message: 'Failed to get balance'
                        });
                    }

                    // convert bigint to hex
                    return this.createResponse<T>(`0x${balance.toString(16)}`);

                // case 'eth_sign':
                //     // not supported
                //     return this.createResponse<T>(undefined, {
                //         code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
                //         message: 'eth_sign not supported'
                //     });
                // case 'eth_sendTransaction':
                //     // not supported
                //     return this.createResponse<T>(undefined, {
                //         code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
                //         message: 'eth_sign not supported'
                //     });

                default:
                    return this.createResponse<T>(undefined, {
                        code: ERROR_CODES.EIP1193.UNSUPPORTED_METHOD,
                        message: `Method ${request.method} not supported`
                    });
            }
        } catch (error) {
            return this.createResponse<T>(undefined, {
                code: ERROR_CODES.EIP1193.INTERNAL_ERROR,
                message: 'Internal error'
            });
        }
    }

    createResponse<T extends EIP1193RequestType>(result?: any, error?: { code: number, message: string }): EIP1193ProviderResponse<T> {
        return {
            jsonrpc: '2.0',
            id: 1,
            result: result,
            error: error,
        };
    }
}