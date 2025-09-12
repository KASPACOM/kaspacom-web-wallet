import { Injectable } from "@angular/core";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";
import { Krc721OperationType, Krc721Deploy, Krc721Mint, Krc721Transfer } from "../../../types/kaspa-network/krc721-operations-data.interface";
import { ProtocolReviewActionDataInterface } from "../interfaces/protocol-review-action-data.interface";

@Injectable({
    providedIn: 'root',
})
export class Krc721ReviewActionDataService implements ProtocolReviewActionDataInterface {

    constructor() { }

    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined {

        if (!action?.actionScript.stringifyAction) {
            return undefined;
        }

        try {
            const operationData: Krc721Deploy | Krc721Mint | Krc721Transfer = JSON.parse(action.actionScript.stringifyAction);

            switch (operationData.op) {
                case Krc721OperationType.TRANSFER:
                    return this.getKrc721TransferActionDisplay(operationData as Krc721Transfer, wallet);
                case Krc721OperationType.MINT:
                    return this.getKrc721MintActionDisplay(operationData as Krc721Mint, wallet);
                case Krc721OperationType.DEPLOY:
                    return this.getKrc721DeployActionDisplay(operationData as Krc721Deploy, wallet);
            }

        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    private getKrc721TransferActionDisplay(operationData: Krc721Transfer, wallet: AppWallet): ActionDisplay {
        return {
            title: "Transfer KRC721 NFT",
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
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "To",
                    fieldValue: operationData.to || '-'
                }
            ]
        }
    }

    private getKrc721MintActionDisplay(operationData: Krc721Mint, wallet: AppWallet): ActionDisplay {
        const rows = [
            {
                fieldName: "Collection",
                fieldValue: operationData.tick.toUpperCase()
            },
            {
                fieldName: "Mint To",
                fieldValue: operationData.to || wallet.getAddress()
            }
        ];

        return {
            title: "Mint KRC721 NFT",
            rows: rows
        }
    }

    private getKrc721DeployActionDisplay(operationData: Krc721Deploy, wallet: AppWallet): ActionDisplay {
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
                fieldName: "Deployer",
                fieldValue: wallet.getAddress()
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
            title: "Deploy KRC721 Collection",
            rows: rows
        }
    }
}