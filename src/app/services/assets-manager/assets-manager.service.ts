import { inject, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Subscription } from "rxjs";
import { WalletService } from "../wallet.service";
import { BaseAssetsStoreService } from "./assets-stores/base-assets-store.service";
import { AppWallet } from "../../classes/AppWallet";
import { L1AssetsStoreService } from "./assets-stores/l1-assets-store.service";
import { L2AssetsStoreService } from "./assets-stores/l2-assets-store.service";
import { EthereumWalletChainManager } from "../etherium-services/etherium-wallet-chain.manager";
import { KaspaL1NetworkService } from "../kaspa-netwrok-services/kaspa-l1-network.service";

@Injectable({
    providedIn: 'root',
})
export class AssetsManagerService {
    // Services
    private walletService = inject(WalletService);
    private l1AssetsStore = inject(L1AssetsStoreService);
    private l2AssetsStore = inject(L2AssetsStoreService);
    private ethereumWalletChainManager = inject(EthereumWalletChainManager);
    private kaspaL1NetworkService = inject(KaspaL1NetworkService);

    // Props
    private currentWallet: AppWallet | undefined;
    private allAssetsStoreServices = {
        l1: this.l1AssetsStore,
        l2: this.l2AssetsStore,
    };
    private currentAssetsStoreService: BaseAssetsStoreService<any>;
    private finishedInitializing = false;



    constructor() {
        this.currentAssetsStoreService = this.walletService.isL2Display() ? this.allAssetsStoreServices.l2 : this.allAssetsStoreServices.l1;

        // Subscribe to wallet changes
        toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
            this.onWalletChanged.bind(this));
        toObservable(this.ethereumWalletChainManager.getCurrentChainSignal()).subscribe(
            this.reloadAllAssets.bind(this));
        toObservable(this.kaspaL1NetworkService.getCurrentNetworkSignal()).subscribe(
            this.reloadAllAssets.bind(this));
    }

    public initializeWalletListenerAndStart(): void {
        this.finishedInitializing = true;
    }


    private async onWalletChanged(wallet: AppWallet | undefined): Promise<void> {
        if (wallet?.getIdWithAccount() !== this.currentWallet?.getIdWithAccount()) {
            this.currentWallet = wallet;
            this.reloadAllAssets();
        }
    }

    private async reloadAllAssets(): Promise<void> {
        if (!this.finishedInitializing) {
            return;
        }
        
        this.currentAssetsStoreService?.stopLoadingAllAssetsAndClear();

        this.currentAssetsStoreService = this.walletService.isL2Display() ? this.allAssetsStoreServices.l2 : this.allAssetsStoreServices.l1;

        if (this.currentWallet) {
            this.currentAssetsStoreService.startLoadingAllAssets();
        }
    }


    getAllAssetStores(): { [K in keyof typeof this.allAssetsStoreServices]: BaseAssetsStoreService<any> } {
        return this.allAssetsStoreServices;
    }

    /**
     *  reloadAllCurrentAssetsAfterUpdate
     */
    public reloadAllCurrentAssetsAfterUpdate() {
        this.currentAssetsStoreService.reloadAllAssets();
    }

    public isAnyAssetLoading(): boolean {
        return this.currentAssetsStoreService.isAnyAssetLoading();
    }
}
