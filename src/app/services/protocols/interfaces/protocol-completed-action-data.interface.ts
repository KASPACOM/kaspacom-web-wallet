import { CommitRevealActionResult } from "@kaspacom/wallet-messages";
import { CompletedActionDisplay } from "../../../types/completed-action-display.type";

export interface ProtocolCompletedActionDataInterface {
    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined;
}