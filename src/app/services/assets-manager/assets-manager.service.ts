import { inject, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Subscription } from "rxjs";
import { WalletService } from "../wallet.service";
import { BaseAssetsStoreService } from "./assets-stores/base-assets-store.service";
import { AppWallet } from "../../classes/AppWallet";
import { L1AssetsStoreService } from "./assets-stores/l1-assets-store.service";

@Injectable({
    providedIn: 'root',
})
export class AssetsManagerService {
    // Services
    private walletService = inject(WalletService);
    private l1AssetsStore = inject(L1AssetsStoreService);

    // Props
    private currentWallet: AppWallet | undefined;
    private walletSubscription: Subscription | undefined;
    private allAssetsStoreServices = {
        l1: this.l1AssetsStore,
    };
    private currentAssetsStoreService: BaseAssetsStoreService<any>;



    constructor() {
        this.currentAssetsStoreService = this.allAssetsStoreServices.l1;
        this.initializeWalletListener();
    }

    private initializeWalletListener(): void {
        // Subscribe to wallet changes
        this.walletSubscription = toObservable(this.walletService.getCurrentWalletSignal()).subscribe(
            this.onWalletChanged.bind(this));

        // Load assets for current wallet if available
        const currentWallet = this.walletService.getCurrentWallet();
        if (currentWallet) {
            this.onWalletChanged(currentWallet);
        }
    }


    private async onWalletChanged(wallet: AppWallet | undefined): Promise<void> {
        if (wallet?.getIdWithAccount() !== this.currentWallet?.getIdWithAccount()) {
            if (this.currentWallet) {
                this.currentAssetsStoreService.stopLoadingAllAssetsAndClear();
            }

            this.currentWallet = wallet;

            if (wallet) {
                // // Navigate to homepage when wallet account changes
                // if (this.router.url.startsWith('/app/')) {
                //     this.router.navigate(['/app/home']);
                // }

                this.currentAssetsStoreService.startLoadingAllAssets();
            } 
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