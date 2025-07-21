import { inject, Injectable } from "@angular/core";
import { ProtocolCompletedActionDataInterface } from "./interfaces/protocol-completed-action-data.interface";
import { ProtocolActionsValidatorInterface } from "./interfaces/protocol-actions-validator.interface";
import { ProtocolReviewActionDataInterface } from "./interfaces/protocol-review-action-data.interface";
import { KasplexCombinedValidatorService } from "./kasplex-combined-validator.service";
import { KasplexCombinedReviewActionDataService } from "./kasplex-combined-review-action-data.service";
import { KasplexCombinedCompletedActionDataService } from "./kasplex-combined-completed-action-data.service";
import { ProtocolType } from "@kaspacom/wallet-messages/dist/types/protocol-type.enum";

export type ProtocolClasess = {
    actionsDataReviewer?: ProtocolReviewActionDataInterface,
    completedActionsDataReviewer?: ProtocolCompletedActionDataInterface,
    validator?: ProtocolActionsValidatorInterface,
}

@Injectable({
    providedIn: 'root',
})
export class BaseProtocolClassesService {
    private protocolClasses: { [key in ProtocolType | string]?: ProtocolClasess } = {
        kasplex: {
            actionsDataReviewer: inject(KasplexCombinedReviewActionDataService),
            completedActionsDataReviewer: inject(KasplexCombinedCompletedActionDataService),
            validator: inject(KasplexCombinedValidatorService),
        }
    };

    
    getClassesFor(protocol: ProtocolType | string): ProtocolClasess {
        return this.protocolClasses[protocol] || {};
    }
}

