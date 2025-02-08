import { CompletedActionDisplay } from "../../../types/completed-action-display.type";
import { CommitRevealActionResult } from "../../../types/wallet-action-result";

export interface ProtocolCompletedActionDataInterface {
    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined;
}