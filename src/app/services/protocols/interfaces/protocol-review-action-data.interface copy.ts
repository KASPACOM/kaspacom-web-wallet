import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";

export interface ProtocolReviewActionDataInterface {
    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined;
}