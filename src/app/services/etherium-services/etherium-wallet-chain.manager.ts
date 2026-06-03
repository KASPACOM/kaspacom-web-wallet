import { Injectable, signal, WritableSignal } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";
import { BaseEthereumProvider } from "./base-ethereum-provider";
import { EIP1193ProviderChain } from "@kaspacom/wallet-messages";
import { environment } from "../../../environments/environment";
import { L2ConfigInterface } from "../../../environments/environment.interface";
import { VIEW_METHOD } from "../wallet.service";

export interface ExtendedEIP1193ProviderChain extends EIP1193ProviderChain {
    defiApiNetworkName?: string;
}

@Injectable({
    providedIn: 'root',
})
export class EthereumWalletChainManager {
    private currentChain: WritableSignal<string | undefined>;
    private currentProvider: BaseEthereumProvider | undefined = undefined;
    protected allChainsByChainId: { [chainId: string]: ExtendedEIP1193ProviderChain } = {};
    protected allChainsEnvConfigByChainId: { [chainId: string]: L2ConfigInterface } = {};
    private customChainsSignal: WritableSignal<ExtendedEIP1193ProviderChain[]> = signal([]);


    constructor(
    ) {
        environment.l2Configs.forEach((config: L2ConfigInterface) => {
            const chainId = config.customChainConfig.chainId;
            this.allChainsEnvConfigByChainId[this.convertChainIdToHex(chainId)] = config;
        });
        this.setAllChainsByChainId();
        this.customChainsSignal.set(this.getCustomChainsFromStorage());


        let curentChain = localStorage.getItem(LOCAL_STORAGE_KEYS.CURRENT_ETHEREUM_CHAIN) || undefined;
        const urlParams = new URLSearchParams(window.location.search);
        const viewTypeParam = urlParams.get('view');
        const chainIdTypeParam = urlParams.get('chain');
        if (viewTypeParam) {
            if (viewTypeParam === VIEW_METHOD.L2) {
                if (chainIdTypeParam && this.allChainsByChainId[chainIdTypeParam]) {
                    curentChain = chainIdTypeParam;
                } else if (!curentChain) {
                    curentChain = Object.keys(this.allChainsEnvConfigByChainId)[0];
                }
            } else {
                curentChain = undefined;
            }
        }
        this.currentChain = signal<string | undefined>(curentChain);

        this.setCurrentWalletProviderAndStopOldOne();
    }

    public getChainEnvConfig(chainId: string): L2ConfigInterface | undefined {
        return this.allChainsEnvConfigByChainId[chainId];
    }

    getChainConfig(chainId: string): ExtendedEIP1193ProviderChain | undefined {
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


    public getAllChainsByChainId(): { [chainId: string]: ExtendedEIP1193ProviderChain } {
        return this.allChainsByChainId;
    }
    private setAllChainsByChainId(): void {
        const allChains: ExtendedEIP1193ProviderChain[] = Object.values(environment.l2Configs)
            .map((config: L2ConfigInterface) => {
                const c = config.customChainConfig;
                return {
                    chainId: this.convertChainIdToHex(c.chainId),
                    chainName: c.name,
                    nativeCurrency: c.nativeToken,
                    rpcUrls: [c.rpcUrl],
                    blockExplorerUrls: c.blockExplorerUrl ? [c.blockExplorerUrl] : [],
                    defiApiNetworkName: c.defiApiNetworkName,
                };
            })
            .concat(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS) || '[]'));

        this.allChainsByChainId = allChains.reduce((acc, chain) => {
            acc[chain.chainId] = chain;
            return acc;
        }, {} as { [chainId: string]: ExtendedEIP1193ProviderChain });
    }

    public addChain(chain: ExtendedEIP1193ProviderChain): void {
        const existing = this.getCustomChainsFromStorage();
        const updated = [...existing, chain];
        localStorage.setItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS, JSON.stringify(updated));
        this.setAllChainsByChainId();
        this.customChainsSignal.set(updated);
    }

    public removeChain(chainId: string): void {
        const existing = this.getCustomChainsFromStorage();
        const updated = existing.filter(c => c.chainId !== chainId);
        localStorage.setItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS, JSON.stringify(updated));
        this.setAllChainsByChainId();
        this.customChainsSignal.set(updated);
        if (this.getCurrentChainSignal()() === chainId) {
            this.setCurrentChain(undefined);
        }
    }

    public isCustomChain(chainId: string): boolean {
        return !this.allChainsEnvConfigByChainId[chainId];
    }

    public getCustomChainsSignal() {
        return this.customChainsSignal.asReadonly();
    }

    private getCustomChainsFromStorage(): ExtendedEIP1193ProviderChain[] {
        return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.ETHEREUM_CHAINS) || '[]');
    }


}
