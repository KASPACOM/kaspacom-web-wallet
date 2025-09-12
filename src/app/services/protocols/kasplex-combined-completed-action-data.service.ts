import { Injectable, inject } from "@angular/core";
import { ActionDisplay } from "../../types/action-display.type";
import { ProtocolCompletedActionDataInterface } from "./interfaces/protocol-completed-action-data.interface";
import { CompletedActionDisplay } from "../../types/completed-action-display.type";
import { CommitRevealActionResult } from "@kaspacom/wallet-messages";
import { Krc20CompletedActionDataService } from "./krc20/krc20-completed-action-data.service";
import { Krc721CompletedActionDataService } from "./krc721/krc721-completed-action-data.service";

@Injectable({
    providedIn: 'root',
})
export class KasplexCombinedCompletedActionDataService implements ProtocolCompletedActionDataInterface {
    private krc20CompletedService = inject(Krc20CompletedActionDataService);
    private krc721CompletedService = inject(Krc721CompletedActionDataService);

    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined {
        try {
            const data = JSON.parse(action.protocolAction);

            // Check the protocol identifier to determine which service to use
            if (data.p === 'krc-20') {
                return this.krc20CompletedService.getActionDisplay(action);
            } else if (data.p === 'krc-721') {
                return this.krc721CompletedService.getActionDisplay(action);
            }
        } catch (error) {
            console.error('Error parsing protocol action:', error);
        }

        return undefined;
    }
}