import { Injectable } from "@angular/core";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";
import { KnsOperationType, KnsCreate, KnsList, KnsSend, KnsTransfer } from "../../../types/kaspa-network/kns-operations-data.interface";
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
            const operationData: KnsCreate | KnsTransfer | KnsList | KnsSend = JSON.parse(action.actionScript.stringifyAction);

            switch (operationData.op) {
                case KnsOperationType.TRANSFER:
                    return this.getKnsTransferActionDisplay(operationData as KnsTransfer, wallet);
                case KnsOperationType.CREATE:
                    return this.getKnsCreateActionDisplay(operationData as KnsCreate, wallet);
                case KnsOperationType.LIST:
                    return this.getKnsListActionDisplay(operationData as KnsList, wallet);
                case KnsOperationType.SEND:
                    return this.getKnsSendActionDisplay(operationData as KnsSend, wallet, action);
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

    private getKnsCreateActionDisplay(operationData: KnsCreate, wallet: AppWallet): ActionDisplay {
        const rows = [
            {
                fieldName: "Asset",
                fieldValue: operationData.v
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
            title: "Create KNS Domain",
            rows: rows
        }
    }

    private getKnsListActionDisplay(operationData: KnsList, wallet: AppWallet): ActionDisplay {
        return {
            title: "List KNS Domain",
            rows: [
                {
                    fieldName: "Asset",
                    fieldValue: operationData.id
                },
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                }
            ]
        }
    }

    private getKnsSendActionDisplay(operationData: KnsSend, wallet: AppWallet, action: CommitRevealAction): ActionDisplay {
        return {
            title: "Send KNS Domain Listing",
            rows: [
                {
                    fieldName: "Asset",
                    fieldValue: operationData.id
                },
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "List Transaction Id",
                    fieldValue: action.options?.commitTransactionId || '-'
                }
            ]
        }
    }
}
