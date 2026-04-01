import { Injectable } from "@angular/core";
import { LOCAL_STORAGE_KEYS } from "../../config/consts";

@Injectable({
    providedIn: 'root',
})
export class AllowedApplicationsService {
    private persistedAppLocations: { [appId: string]: string[] };
    private sessionAppLocations: { [appId: string]: string[] } = {};

    constructor() {
        const allowedApplications = localStorage.getItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS);
        if (allowedApplications) {
            this.persistedAppLocations = JSON.parse(allowedApplications);
        } else {
            this.persistedAppLocations = {};
        }
    }

    isAllowedApplication(appId: string, currentWalletIdWithAccount: string): boolean {
        return this.persistedAppLocations[appId]?.includes(currentWalletIdWithAccount)
            || this.sessionAppLocations[appId]?.includes(currentWalletIdWithAccount)
            || false;
    }

    addAllowedApplication(appId: string, currentWalletIdWithAccount: string, persist = true) {
        if (persist) {
            this.persistedAppLocations[appId] = this.persistedAppLocations[appId] || [];
            if (!this.persistedAppLocations[appId].includes(currentWalletIdWithAccount)) {
                this.persistedAppLocations[appId].push(currentWalletIdWithAccount);
            }
            this.saveToLocalStorage();
        } else {
            this.sessionAppLocations[appId] = this.sessionAppLocations[appId] || [];
            if (!this.sessionAppLocations[appId].includes(currentWalletIdWithAccount)) {
                this.sessionAppLocations[appId].push(currentWalletIdWithAccount);
            }
        }
    }

    removeAllowedApplication(appId: string) {
        delete this.persistedAppLocations[appId];
        delete this.sessionAppLocations[appId];
        this.saveToLocalStorage();
    }

    private saveToLocalStorage() {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ALLOWED_APPLICATIONS, JSON.stringify(this.persistedAppLocations));
    }
}
