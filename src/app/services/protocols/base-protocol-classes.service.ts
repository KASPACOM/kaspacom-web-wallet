import { inject, Injectable } from "@angular/core";
import { Krc20ReviewActionDataService } from "./krc20/krc20-review-action-data.service";
import { ProtocolCompletedActionDataInterface } from "./interfaces/protocol-completed-action-data.interface";
import { ProtocolActionsValidatorInterface } from "./interfaces/protocol-actions-validator.interface";
import { Krc20ActionsValidatorService } from "./krc20/krc20-actions-validator.service";
import { ProtocolReviewActionDataInterface } from "./interfaces/protocol-review-action-data.interface";
import { Krc20CompletedActionDataService } from "./krc20/krc20-completed-action-data.service";
import { ProtocolType } from "kaspacom-wallet-messages/dist/types/protocol-type.enum";

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
            actionsDataReviewer: inject(Krc20ReviewActionDataService),
            completedActionsDataReviewer: inject(Krc20CompletedActionDataService),
            validator: inject(Krc20ActionsValidatorService),
        }
    };

    
    getClassesFor(protocol: ProtocolType | string): ProtocolClasess {
        return this.protocolClasses[protocol] || {};
    }
}

