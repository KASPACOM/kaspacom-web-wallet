import { Injectable } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KNS_TRANSACTIONS_PRICE, KnsOperationDataService } from "./kns-operation-data.service";
import { KaspaNetworkActionsService } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { UtilsHelper } from "../../utils.service";
import { ProtocolType } from "@kaspacom/wallet-messages/dist/types/protocol-type.enum";

const CURRENT_PROTOCOL = ProtocolType.KNS;

@Injectable({
    providedIn: 'root',
})
export class KnsWalletActionService {
    constructor(
        private knsOperationDataService: KnsOperationDataService,
        private kaspaNetworkActionsService: KaspaNetworkActionsService,
        private utils: UtilsHelper,
    ) { }

    createInscribeWalletAction(
        assetId: string,
        isDomain: boolean,
        textRecords?: { [key: string]: string }
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getInscribeData(assetId, isDomain, textRecords)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.INSCRIBE,
                }
            },
        };
    }

    createTransferWalletAction(assetId: string, isDomain: boolean, toAddress: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getTransferData(assetId, isDomain, toAddress)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.TRANSFER,
                }
            },
        };
    }

    createUpdateWalletAction(
        assetId: string,
        isDomain: boolean,
        textRecords: { [key: string]: string }
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getUpdateData(assetId, isDomain, textRecords)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.UPDATE,
                }
            },
        };
    }
}
