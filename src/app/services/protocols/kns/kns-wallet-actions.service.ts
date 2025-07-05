import { Injectable } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KNS_TRANSACTIONS_PRICE, KnsOperationDataService } from "./kns-operation-data.service";
import { KaspaNetworkActionsService } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { UtilsHelper } from "../../utils.service";
import { ProtocolType } from "kaspacom-wallet-messages/dist/types/protocol-type.enum";

const CURRENT_PROTOCOL = ProtocolType.KASPLEX;

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
        domainName: string,
        textRecords?: { [key: string]: string }
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getInscribeData(domainName, textRecords)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.INSCRIBE,
                }
            },
        };
    }

    createTransferWalletAction(domainName: string, toAddress: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getTransferData(domainName, toAddress)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.TRANSFER,
                }
            },
        };
    }

    createUpdateWalletAction(
        domainName: string,
        textRecords: { [key: string]: string }
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getUpdateData(domainName, textRecords)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.UPDATE,
                }
            },
        };
    }
}