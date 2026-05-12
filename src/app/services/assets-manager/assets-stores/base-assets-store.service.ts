import { inject, Signal, signal, WritableSignal } from "@angular/core";
import { WalletService } from "../../wallet.service";

export type BaseAssetStoreData = {
    [key: string]: any;
}

export abstract class BaseAssetsStoreService<T extends BaseAssetStoreData> {

    // services
    protected walletService = inject(WalletService);

    protected data: { [K in keyof T]: WritableSignal<T[K][] | undefined> } = {} as any;
    protected autoReloadInterval: ReturnType<typeof setTimeout> | undefined;
    protected loadAssetsFunctionsNames: { [K in keyof T]: string }
    protected loadAssetsTimeouts: { [K in keyof T]: ReturnType<typeof setTimeout> | undefined } | undefined;
    private loadAssetsGeneration = 0;


    protected assetsLoaderInfo: {
        [K in keyof T]: {
            loading: WritableSignal<boolean>;
        }
    } = {} as {
        [K in keyof T]: {
            loading: WritableSignal<boolean>;
        };
    };

    protected AUTO_RELOAD_INTERVAL = 20000; // 20 seconds

    private assetListeners: {
        [K in keyof T]?: Set<(items: T[K][] | undefined) => void>;
    } = {};

    constructor() {
        this.loadAssetsFunctionsNames = this.getLoadFunctionAssetsNames();

        for (let key in this.loadAssetsFunctionsNames) {
            this.data[key] = signal(undefined);
            this.assetsLoaderInfo[key] = {
                loading: signal(false),
            };
            this.assetListeners[key] = new Set();
        }
    }

    protected abstract getLoadFunctionAssetsNames(): { [K in keyof T]: string };

    onAssetsUpdated<K extends keyof T>(
        key: K,
        listener: (items: T[K][] | undefined) => void,
    ): () => void {
        if (!this.assetListeners[key]) {
            this.assetListeners[key] = new Set();
        }

        this.assetListeners[key]!.add(listener);

        return () => {
            this.assetListeners[key]?.delete(listener);
        };
    }

    private notifyAssetListeners<K extends keyof T>(
        key: K,
        items: T[K][] | undefined,
    ): void {
        this.assetListeners[key]?.forEach((listener) => listener(items));
    }

    protected clearAllAssets(): void {
        for (let key in this.data) {
            this.data[key].set(undefined);
            this.notifyAssetListeners(key as keyof T, undefined);
        }
    }

    public startLoadingAllAssets(): void {
        if (this.loadAssetsTimeouts) {
            throw new Error('Assets are already loading');
        }

        this.loadAssetsGeneration++;
        const generation = this.loadAssetsGeneration;
        const timeouts = {} as { [K in keyof T]: ReturnType<typeof setTimeout> | undefined };
        this.loadAssetsTimeouts = timeouts;
        for (let key in this.loadAssetsFunctionsNames) {
            timeouts[key] = undefined;
            this.loadAssetAndSetTimeout(key, generation);
        }
    }

    public reloadAllAssets() {
        if (!this.loadAssetsTimeouts) {
            return;
        }

        for (let key in this.loadAssetsFunctionsNames) {
            this.reloadAsset(key);
        }
    }

    public reloadAsset(key: keyof T) {
        if (this.loadAssetsTimeouts) {
            clearTimeout(this.loadAssetsTimeouts[key]);
            this.loadAssetsTimeouts[key] = undefined;
            this.loadAssetAndSetTimeout(key, this.loadAssetsGeneration);
        }
    }

    public stopLoadingAllAssetsAndClear(): void {
        this.loadAssetsGeneration++;

        if (this.loadAssetsTimeouts) {
            for (let key in this.loadAssetsTimeouts) {
                clearTimeout(this.loadAssetsTimeouts[key]);
            }
            this.loadAssetsTimeouts = undefined;
        }

        for (let key in this.assetsLoaderInfo) {
            this.assetsLoaderInfo[key].loading.set(false);
        }

        this.clearAllAssets();
    }

    private isActiveLoadGeneration(generation: number): boolean {
        return !!this.loadAssetsTimeouts && generation === this.loadAssetsGeneration;
    }

    protected async loadAsset(key: keyof T, generation = this.loadAssetsGeneration): Promise<void> {
        if (!this.isActiveLoadGeneration(generation)) {
            return;
        }

        this.assetsLoaderInfo[key].loading.set(true);

        try {
            const assets = await this.runLoadAssetFunction(key);
            if (!this.isActiveLoadGeneration(generation)) {
                return;
            }
            this.data[key].set(assets);
            this.notifyAssetListeners(key, assets);
        } catch (e) {
            console.error(`Error loading ${key.toString()} assets`);
            console.error(e);
        } finally {
            if (this.isActiveLoadGeneration(generation)) {
                this.assetsLoaderInfo[key].loading.set(false);
            }
        }
    }


    protected async loadAssetAndSetTimeout(key: keyof T, generation = this.loadAssetsGeneration) {
        if (!this.isActiveLoadGeneration(generation)) {
            return;
        }

        try {
            await this.loadAsset(key, generation);
        } catch (e) {
            console.error(`Error loading ${key.toString()} assets`);
            console.error(e);
        }

        if (!this.isActiveLoadGeneration(generation)) {
            return;
        }

        const timeouts = this.loadAssetsTimeouts;
        if (!timeouts) {
            return;
        }

        timeouts[key] = setTimeout(() => {
            this.loadAssetAndSetTimeout(key, generation);
        }, this.AUTO_RELOAD_INTERVAL);
    }

    getAssetSignal(key: keyof T): Signal<T[keyof T][] | undefined> {
        return this.data[key].asReadonly();
    }

    getAssetLoadingSignal(key: keyof T): Signal<boolean> {
        return this.assetsLoaderInfo[key].loading.asReadonly();
    }

    getAssets(key: keyof T): T[keyof T][] {
        return this.data[key]() || [];
    }

    isAnyAssetLoading(): boolean {
        for (let key in this.assetsLoaderInfo) {
            if (this.assetsLoaderInfo[key].loading()) {
                return true;
            }
        }
        return false;
    }

    protected getWalletAddress(): string {
        if (!this.walletService.getCurrentWallet()) {
            throw new Error('Trying to load assets without wallet');
        }

        if (this.walletService.isL2Display()) {
            return this.walletService.getCurrentWallet()!.getL2WalletAddress() || '';
        }

        return this.walletService.getCurrentWallet()!.getAddress();
    }

    protected async runLoadAssetFunction<K extends keyof T>(key: K): Promise<T[K][] | undefined> {
        const walletAddress = this.getWalletAddress();

        if (!walletAddress) {
            throw new Error('Trying to load assets without wallet');
        }

        const funcName = this.loadAssetsFunctionsNames[key];
        const fn = (this as any)[funcName] as ((walletAddress: string) => Promise<T[K][]> | undefined);

        if (typeof fn === 'function') {
            return await fn.call(this, walletAddress);
        } else {
            return Promise.reject(new Error(`Load Asset function not found for key: ${String(key)}`));
        }
    }

    protected updateOrAddAsset(assetKey: keyof T, asset: T[keyof T], uniqueIdProp: string = 'id', toLowerCase?: boolean): void {
        if (!this.data[assetKey]()) {
            throw new Error(`Asset not found for key: ${String(assetKey)}`);
        }

        const currentData = [...(this.data[assetKey]()!)];

        let assetPropVal = asset[uniqueIdProp];
        if (toLowerCase) {
            assetPropVal = assetPropVal.toLowerCase();
        }

        for (let i = 0; i < currentData.length; i++) {
            if (toLowerCase ? currentData[i][uniqueIdProp].toLowerCase() === assetPropVal : currentData[i][uniqueIdProp] === asset[uniqueIdProp]) {
                currentData[i] = asset;
                this.data[assetKey].set(currentData);
                this.notifyAssetListeners(assetKey, currentData);
                return;
            }
        }

        currentData.push(asset);
        this.data[assetKey].set(currentData);
        this.notifyAssetListeners(assetKey, currentData);
    }

}