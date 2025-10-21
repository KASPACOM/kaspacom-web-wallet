import { Injectable, signal } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";
import { BaseEthereumProvider } from "./base-ethereum-provider";
import { EIP1193ProviderChain } from "@kaspacom/wallet-messages";
import { environment } from "../../../environments/environment";
import { L2ConfigInterface } from "../../../environments/environment.interface";
import { NETWORKS } from '@kaspacom/swap-sdk';

@Injectable({
    providedIn: 'root',
})
export class EthereumWalletChainManager {
    private currentChain = signal<string | undefined>(localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_ETHEREUM_CHAIN) || undefined);
    private currentProvider: BaseEthereumProvider | undefined = undefined;
    protected allChainsByChainId: { [chainId: string]: EIP1193ProviderChain } = {};
    protected allChainsEnvConfigByChainId: { [chainId: string]: L2ConfigInterface } = {};


    constructor(
    ) {
        if (!environment.isL2Enabled) {
            return;
        }
        environment.l2Configs.forEach((config: L2ConfigInterface) => {
            this.allChainsEnvConfigByChainId[this.convertChainIdToHex(NETWORKS[config.sdkName].chainId)] = config;
        });

        this.setAllChainsByChainId();
        this.setCurrentWalletProviderAndStopOldOne();
    }

    public getChainEnvConfig(chainId: string): L2ConfigInterface | undefined {
        return this.allChainsEnvConfigByChainId[chainId];
    }

    getChainConfig(chainId: string): EIP1193ProviderChain | undefined {
        return this.getAllChainsByChainId()[chainId];
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
        const allChains: EIP1193ProviderChain[] = Object.values(environment.l2Configs).map((config: L2ConfigInterface) => ({
            chainId: this.convertChainIdToHex(NETWORKS[config.sdkName].chainId),
            chainName: NETWORKS[config.sdkName].name,
            nativeCurrency: NETWORKS[config.sdkName].nativeToken,
            rpcUrls: [NETWORKS[config.sdkName].rpcUrl],
            blockExplorerUrls: NETWORKS[config.sdkName].blockExplorerUrl ? [NETWORKS[config.sdkName].blockExplorerUrl!] : [],
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
