import { Injectable } from "@angular/core";
import { ActionDisplay } from "../../../types/action-display.type";
import { Krc721OperationType, Krc721Deploy, Krc721Mint, Krc721Transfer, Krc721List, Krc721Send } from "../../../types/kaspa-network/krc721-operations-data.interface";
import { ProtocolCompletedActionDataInterface } from "../interfaces/protocol-completed-action-data.interface";
import { CompletedActionDisplay } from "../../../types/completed-action-display.type";
import { CommitRevealActionResult } from "@kaspacom/wallet-messages";

@Injectable({
    providedIn: 'root',
})
export class Krc721CompletedActionDataService implements ProtocolCompletedActionDataInterface {

    constructor() { }

    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined {

        try {
            const operationData: Krc721Deploy | Krc721Mint | Krc721Transfer | Krc721List | Krc721Send = JSON.parse(action.protocolAction);

            switch (operationData.op) {
                case Krc721OperationType.TRANSFER:
                    return this.getKrc721TransferActionDisplay(action, operationData as Krc721Transfer);
                case Krc721OperationType.MINT:
                    return this.getKrc721MintActionDisplay(action, operationData as Krc721Mint);
                case Krc721OperationType.DEPLOY:
                    return this.getKrc721DeployActionDisplay(action, operationData as Krc721Deploy);
                case Krc721OperationType.LIST:
                    return this.getKrc721ListActionDisplay(action, operationData as Krc721List);
                case Krc721OperationType.SEND:
                    return this.getKrc721CancelListActionDisplay(action, operationData as Krc721Send);
            }

        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    private getKrc721TransferActionDisplay(action: CommitRevealActionResult, operationData: Krc721Transfer): ActionDisplay {
        return {
            title: "Transfer KRC721 NFT Transaction",
            rows: [
                {
                    fieldName: "Collection",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Token ID",
                    fieldValue: operationData.tokenId
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

    private getKrc721MintActionDisplay(action: CommitRevealActionResult, operationData: Krc721Mint): ActionDisplay {
        const rows = [
            {
                fieldName: "Collection",
                fieldValue: operationData.tick.toUpperCase()
            },
            {
                fieldName: "Minted To",
                fieldValue: operationData.to || action.performedByWallet
            }
        ];

        return {
            title: "Mint KRC721 NFT Transaction",
            rows: rows
        }
    }

    private getKrc721DeployActionDisplay(action: CommitRevealActionResult, operationData: Krc721Deploy): ActionDisplay {
        const rows = [
            {
                fieldName: "Collection",
                fieldValue: operationData.tick.toUpperCase()
            },
            {
                fieldName: "Max Supply",
                fieldValue: operationData.max
            },
            {
                fieldName: "Deployed By",
                fieldValue: action.performedByWallet
            }
        ];

        // Add optional fields if they exist
        if (operationData.lim) {
            rows.push({
                fieldName: "Mint Limit",
                fieldValue: operationData.lim
            });
        }

        if (operationData.pre) {
            rows.push({
                fieldName: "Pre Allocation",
                fieldValue: operationData.pre
            });
        }

        if (operationData.dec) {
            rows.push({
                fieldName: "Description",
                fieldValue: operationData.dec
            });
        }

        if (operationData.sch) {
            rows.push({
                fieldName: "Schema",
                fieldValue: operationData.sch
            });
        }

        if (operationData.buri) {
            rows.push({
                fieldName: "Base URI",
                fieldValue: operationData.buri
            });
        }

        return {
            title: "Deploy KRC721 Collection Transaction",
            rows: rows
        }
    }

    private getKrc721ListActionDisplay(action: CommitRevealActionResult, operationData: Krc721List): ActionDisplay {
        return {
            title: "List KRC721 NFT Transaction",
            rows: [
                {
                    fieldName: "Collection",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Token ID",
                    fieldValue: operationData.tokenId
                },
                {
                    fieldName: "Listed By",
                    fieldValue: action.performedByWallet
                }
            ]
        }
    }

    private getKrc721CancelListActionDisplay(action: CommitRevealActionResult, operationData: Krc721Send): ActionDisplay {
        return {
            title: "Cancel KRC721 NFT Listing Transaction",
            rows: [
                {
                    fieldName: "Collection",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Token ID",
                    fieldValue: operationData.tokenId
                },
                {
                    fieldName: "Wallet",
                    fieldValue: action.performedByWallet
                },
                {
                    fieldName: "Reveal Transaction Id",
                    fieldValue: action.revealTransactionId
                }
            ]
        }
    }
}
