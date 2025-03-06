import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";

export interface ProtocolActionsValidatorInterface {

    /**
     * Validates the commit reveal action
     * @param action The commit reveal action to validate
     * @param wallet The wallet used to validate the action
     * @returns A promise with the validation result
     */
    validateCommitRevealAction(
        action: CommitRevealAction,
        wallet: AppWallet
    ): Promise<{ isValidated: boolean; errorCode?: number }>;
}
