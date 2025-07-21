import { Injectable } from "@angular/core";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";
import { KnsOperationType, KnsInscribe, KnsTransfer, KnsUpdate } from "../../../types/kaspa-network/kns-operations-data.interface";
import { ProtocolReviewActionDataInterface } from "../interfaces/protocol-review-action-data.interface";

@Injectable({
    providedIn: 'root',
})
export class KnsReviewActionDataService implements ProtocolReviewActionDataInterface {

    constructor() { }

    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined {

        if (!action?.actionScript.stringifyAction) {
            return undefined;
        }

        try {
            const operationData: KnsInscribe | KnsTransfer | KnsUpdate = JSON.parse(action.actionScript.stringifyAction);

            switch (operationData.op) {
                case KnsOperationType.TRANSFER:
                    return this.getKnsTransferActionDisplay(operationData as KnsTransfer, wallet);
                case KnsOperationType.INSCRIBE:
                    return this.getKnsInscribeActionDisplay(operationData as KnsInscribe, wallet);
                case KnsOperationType.UPDATE:
                    return this.getKnsUpdateActionDisplay(operationData as KnsUpdate, wallet);
            }

        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    private getKnsTransferActionDisplay(operationData: KnsTransfer, wallet: AppWallet): ActionDisplay {
        return {
            title: "Transfer KNS Asset",
            rows: [
                {
                    fieldName: "Asset",
                    fieldValue: operationData.id
                },
                {
                    fieldName: "From",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "To",
                    fieldValue: operationData.to || '-'
                }
            ]
        }
    }

    private getKnsInscribeActionDisplay(operationData: KnsInscribe, wallet: AppWallet): ActionDisplay {
        const rows = [
            {
                fieldName: "Asset",
                fieldValue: operationData.id
            },
            {
                fieldName: "Owner",
                fieldValue: wallet.getAddress()
            }
        ];

        // Add text records if they exist
        if (operationData.text) {
            Object.entries(operationData.text).forEach(([key, value]) => {
                rows.push({
                    fieldName: `Text: ${key}`,
                    fieldValue: value
                });
            });
        }

        return {
            title: "Inscribe KNS Asset",
            rows: rows
        }
    }

    private getKnsUpdateActionDisplay(operationData: KnsUpdate, wallet: AppWallet): ActionDisplay {
        const rows = [
            {
                fieldName: "Asset",
                fieldValue: operationData.id
            },
            {
                fieldName: "Owner",
                fieldValue: wallet.getAddress()
            }
        ];

        // Add text records being updated
        if (operationData.text) {
            Object.entries(operationData.text).forEach(([key, value]) => {
                rows.push({
                    fieldName: `Update: ${key}`,
                    fieldValue: value
                });
            });
        }

        return {
            title: "Update KNS Asset",
            rows: rows
        }
    }
}