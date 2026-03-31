import { Injectable } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";

@Injectable({
    providedIn: 'root',
})
export class AllowedApplicationsService {
    private allowedAppLocations: { [appId: string]: string[] };

    constructor() {
        const allowedApplications = localStorage.getItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS);
        if (allowedApplications) {
            this.allowedAppLocations = JSON.parse(allowedApplications);
        } else {
            this.allowedAppLocations = {};
        }
    }

    isAllowedApplication(appId: string, currentWalletIdWithAccount: string): boolean {
        return this.allowedAppLocations[appId]?.includes(currentWalletIdWithAccount) || false;
    }

    addAllowedApplication(appId: string, currentWalletIdWithAccount: string, persist = true) {
        this.allowedAppLocations[appId] = this.allowedAppLocations[appId] || [];
        if (!this.allowedAppLocations[appId].includes(currentWalletIdWithAccount)) {
            this.allowedAppLocations[appId].push(currentWalletIdWithAccount);
        }

        if (persist) {
            this.saveToLocalStorage();
        }
    }

    removeAllowedApplication(appId: string) {
        delete this.allowedAppLocations[appId];
        this.saveToLocalStorage();
    }


    saveToLocalStorage() {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS, JSON.stringify(this.allowedAppLocations));
    }
}
