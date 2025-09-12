import { Injectable, signal } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";
import { BaseEthereumProvider } from "./base-ethereum-provider";
import { EIP1193ProviderChain } from "@kaspacom/wallet-messages";
import { environment } from "../../../environments/environment";
import { L2ConfigInterface } from "../../../environments/environment.interface";

@Injectable({
    providedIn: 'root',
})
export class EthereumWalletChainManager {
    private currentChain = signal<string | undefined>(localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_ETHEREUM_CHAIN) || undefined);
    private currentProvider: BaseEthereumProvider | undefined = undefined;
    protected allChainsByChainId: { [chainId: string]: EIP1193ProviderChain } = {};


    constructor(
    ) {
        if (!environment.isL2Enabled) {
            return;
        }
        this.setAllChainsByChainId();
        this.setCurrentWalletProviderAndStopOldOne();
    }


    public getCurrentChainSignal() {
        return this.currentChain.asReadonly();
    }

    public setCurrentChain(chain: string | undefined) {
        if (chain) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.CURRENT_ETHEREUM_CHAIN, chain);
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEYS.CURRENT_ETHEREUM_CHAIN);
        }

        this.currentChain.set(chain);
        this.setCurrentWalletProviderAndStopOldOne();
    }

    public convertChainIdToHex(chainId: number): string {
        return `0x${chainId.toString(16)}`;
    }

    public getCurrentWalletProvider(): BaseEthereumProvider | undefined {
        return this.currentProvider;
    }

    private setCurrentWalletProviderAndStopOldOne(): void {
        if (this.currentProvider) {
            this.currentProvider.disconnect();
            this.currentProvider = undefined;
        }

        const currentChain = this.getCurrentChainSignal()();
        if (!currentChain) {
            return;
        }

        const chainConfig = this.getAllChainsByChainId()[currentChain];
        if (!chainConfig) {
            return;
        }

        this.currentProvider = new BaseEthereumProvider(chainConfig);
    }


    public getAllChainsByChainId(): { [chainId: string]: EIP1193ProviderChain } {
        return this.allChainsByChainId;
    }

    private setAllChainsByChainId(): void {
        const allChains: EIP1193ProviderChain[] = Object.values(environment.l2Configs).map((config: any) => ({
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


}
