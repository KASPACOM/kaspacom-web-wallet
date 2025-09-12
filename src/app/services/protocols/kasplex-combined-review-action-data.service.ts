import { Injectable, inject } from "@angular/core";
import { AppWallet } from "../../classes/AppWallet";
import { CommitRevealAction } from "../../types/wallet-action";
import { ActionDisplay } from "../../types/action-display.type";
import { ProtocolReviewActionDataInterface } from "./interfaces/protocol-review-action-data.interface";
import { Krc20ReviewActionDataService } from "./krc20/krc20-review-action-data.service";
import { Krc721ReviewActionDataService } from "./krc721/krc721-review-action-data.service";

@Injectable({
    providedIn: 'root',
})
export class KasplexCombinedReviewActionDataService implements ProtocolReviewActionDataInterface {
    private krc20ReviewService = inject(Krc20ReviewActionDataService);
    private krc721ReviewService = inject(Krc721ReviewActionDataService);

    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined {
        if (!action?.actionScript.stringifyAction) {
            return undefined;
        }

        try {
            const data = JSON.parse(action.actionScript.stringifyAction);

            // Check the protocol identifier to determine which service to use
            if (data.p === 'krc-20') {
                return this.krc20ReviewService.getActionDisplay(action, wallet);
            } else if (data.p === 'krc-721') {
                return this.krc721ReviewService.getActionDisplay(action, wallet);
            }
        } catch (error) {
            console.error('Error parsing action script:', error);
        }

        return undefined;
    }
}