import { Injectable } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KNS_TRANSACTIONS_PRICE, KnsOperationDataService } from "./kns-operation-data.service";
import { KaspaNetworkActionsService, REVEAL_PSKT_AMOUNT } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
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

    createCreateWalletAction(
        domain: string,
        isDomain: boolean,
        textRecords?: { [key: string]: string }
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getCreateData(domain, isDomain, textRecords)
                    ),
                },
                options: {
                    revealPriorityFee: KNS_TRANSACTIONS_PRICE.CREATE,
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

    createListKnsAction(
        walletAddress: string,
        assetId: string,
        psktOutputs: {
            address: string;
            amount: bigint;
        }[],
    ): WalletAction {
        const sendData = this.knsOperationDataService.getSendData(assetId);

        const sendScript = this.kaspaNetworkActionsService.createGenericScriptFromString(
            CURRENT_PROTOCOL,
            this.utils.stringifyProtocolAction(sendData),
            walletAddress,
        );

        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getListData(assetId)
                    ),
                },
                options: {
                    additionalOutputs: [{
                        address: sendScript.scriptAddress,
                        amount: REVEAL_PSKT_AMOUNT,
                    }],
                    revealPskt: {
                        outputs: psktOutputs,
                        script: sendScript,
                    }
                }
            },
        };
    }

    createCancelListingKnsAction(assetId: string, transactionId: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.knsOperationDataService.getSendData(assetId)
                    ),
                },
                options: {
                    commitTransactionId: transactionId
                }
            },
        };
    }
}
