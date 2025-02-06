import { Injectable } from "@angular/core";
import { Krc20ReviewActionDataService } from "./krc20/krc20-review-action-data.service";
import { KaspaScriptProtocolType } from "../../types/kaspa-network/kaspa-script-protocol-type.enum";
import { ProtocolReviewActionDataInterface } from "./interfaces/protocol-review-action-data.interface";
import { ProtocolActionsValidatorInterface } from "./interfaces/protocol-actions-validator.interface";
import { Krc20ActionsValidatorService } from "./krc20/krc20-actions-validator.service";

export type ProtocolClasess = {
    actionsDataReviewer?: ProtocolReviewActionDataInterface,
    validator?: ProtocolActionsValidatorInterface,
}

@Injectable({
    providedIn: 'root',
})
export class BaseProtocolClassesService {
    private protocolClasses: { [key in KaspaScriptProtocolType]?: ProtocolClasess } = {};

    constructor(private readonly krc20ReviewActionDataService: Krc20ReviewActionDataService,
        private readonly krc20ActionsValidatorService: Krc20ActionsValidatorService,
    ) {
        this.protocolClasses = {
            kasplex: {
                actionsDataReviewer: this.krc20ReviewActionDataService,
                validator: this.krc20ActionsValidatorService
            }
        }
    }

    getClassesFor(protocol: KaspaScriptProtocolType): ProtocolClasess {
        return this.protocolClasses[protocol] || {}; 
    }
}

