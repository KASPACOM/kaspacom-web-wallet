import { Injectable } from "@angular/core";
import { ActionDisplay } from "../../../types/action-display.type";
import { KnsOperationType, KnsInscribe, KnsTransfer, KnsUpdate } from "../../../types/kaspa-network/kns-operations-data.interface";
import { ProtocolCompletedActionDataInterface } from "../interfaces/protocol-completed-action-data.interface";
import { CompletedActionDisplay } from "../../../types/completed-action-display.type";
import { CommitRevealActionResult } from "@kaspacom/wallet-messages";

@Injectable({
    providedIn: 'root',
})
export class KnsCompletedActionDataService implements ProtocolCompletedActionDataInterface {

    constructor() { }

    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined {

        try {
            const operationData: KnsInscribe | KnsTransfer | KnsUpdate = JSON.parse(action.protocolAction);

            switch (operationData.op) {
                case KnsOperationType.TRANSFER:
                    return this.getKnsTransferActionDisplay(action, operationData as KnsTransfer);
                case KnsOperationType.INSCRIBE:
                    return this.getKnsInscribeActionDisplay(action, operationData as KnsInscribe);
                case KnsOperationType.UPDATE:
                    return this.getKnsUpdateActionDisplay(action, operationData as KnsUpdate);
            }

        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    private getKnsTransferActionDisplay(action: CommitRevealActionResult, operationData: KnsTransfer): ActionDisplay {
        return {
            title: "Transfer KNS Asset Transaction",
            rows: [
                {
                    fieldName: "Asset",
                    fieldValue: operationData.id
                },
                {
                    fieldName: "From",
                    fieldValue: action.performedByWallet
                },
                {
                    fieldName: "To",
                    fieldValue: operationData.to || '-'
                }
            ]
        }
    }

    private getKnsInscribeActionDisplay(action: CommitRevealActionResult, operationData: KnsInscribe): ActionDisplay {
        const rows = [
            {
                fieldName: "Asset",
                fieldValue: operationData.id
            },
            {
                fieldName: "Inscribed By",
                fieldValue: action.performedByWallet
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
            title: "Inscribe KNS Asset Transaction",
            rows: rows
        }
    }

    private getKnsUpdateActionDisplay(action: CommitRevealActionResult, operationData: KnsUpdate): ActionDisplay {
        const rows = [
            {
                fieldName: "Asset",
                fieldValue: operationData.id
            },
            {
                fieldName: "Updated By",
                fieldValue: action.performedByWallet
            }
        ];

        // Add text records being updated
        if (operationData.text) {
            Object.entries(operationData.text).forEach(([key, value]) => {
                rows.push({
                    fieldName: `Updated: ${key}`,
                    fieldValue: value
                });
            });
        }

        return {
            title: "Update KNS Asset Transaction",
            rows: rows
        }
    }
}