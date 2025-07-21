import { Injectable, inject } from "@angular/core";
import { ProtocolActionsValidatorInterface } from "./interfaces/protocol-actions-validator.interface";
import { AppWallet } from "../../classes/AppWallet";
import { CommitRevealAction } from "../../types/wallet-action";
import { ERROR_CODES } from "@kaspacom/wallet-messages";
import { Krc20ActionsValidatorService } from "./krc20/krc20-actions-validator.service";
import { Krc721ActionsValidatorService } from "./krc721/krc721-actions-validator.service";
import { KnsActionsValidatorService } from "./kns/kns-actions-validator.service";

@Injectable({
    providedIn: 'root',
})
export class KasplexCombinedValidatorService implements ProtocolActionsValidatorInterface {
    private krc20Validator = inject(Krc20ActionsValidatorService);
    private krc721Validator = inject(Krc721ActionsValidatorService);
    private knsValidator = inject(KnsActionsValidatorService);

    async validateCommitRevealAction(action: CommitRevealAction, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        try {
            const data = JSON.parse(action.actionScript.stringifyAction);

            // Check the protocol identifier to determine which validator to use
            if (data.p === 'krc-20') {
                return await this.krc20Validator.validateCommitRevealAction(action, wallet);
            } else if (data.p === 'krc-721') {
                return await this.krc721Validator.validateCommitRevealAction(action, wallet);
            } else if (data.p === 'kns') {
                return await this.knsValidator.validateCommitRevealAction(action, wallet);
            }
        } catch (error) {
            console.error('Error parsing action script:', error);
        }

        return {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
        };
    }
}