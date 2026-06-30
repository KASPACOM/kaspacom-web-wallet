import { Injectable } from "@angular/core";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";
import { Krc721OperationType, Krc721Deploy, Krc721Mint, Krc721Transfer, Krc721List, Krc721Send } from "../../../types/kaspa-network/krc721-operations-data.interface";
import { ProtocolReviewActionDataInterface } from "../interfaces/protocol-review-action-data.interface";
import { KaspaNetworkActionsService } from "../../kaspa-netwrok-services/kaspa-network-actions.service";

@Injectable({
    providedIn: 'root',
})
export class Krc721ReviewActionDataService implements ProtocolReviewActionDataInterface {

    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService) { }

    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined {

        if (!action?.actionScript.stringifyAction) {
            return undefined;
        }

        try {
            const operationData: Krc721Deploy | Krc721Mint | Krc721Transfer | Krc721List | Krc721Send = JSON.parse(action.actionScript.stringifyAction);

            switch (operationData.op) {
                case Krc721OperationType.TRANSFER:
                    return this.getKrc721TransferActionDisplay(operationData as Krc721Transfer, wallet);
                case Krc721OperationType.MINT:
                    return this.getKrc721MintActionDisplay(operationData as Krc721Mint, wallet);
                case Krc721OperationType.DEPLOY:
                    return this.getKrc721DeployActionDisplay(operationData as Krc721Deploy, wallet);
                case Krc721OperationType.LIST:
                    return this.getKrc721ListActionDisplay(operationData as Krc721List, wallet, action);
                case Krc721OperationType.SEND:
                    if (action.options?.commitTransactionId) {
                        return this.getKrc721CancelListActionDisplay(operationData as Krc721Send, wallet, action);
                    }
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

    private getKrc721ListActionDisplay(operationData: Krc721List, wallet: AppWallet, action: CommitRevealAction): ActionDisplay {
        let totalPrice = "Unknown";

        if (action.options?.revealPskt) {
            const totalAmount = action.options.revealPskt.outputs
                ?.filter(output => output.address === wallet.getAddress())
                .reduce((acc, output) => acc + output.amount, 0n);

            totalPrice = totalAmount && totalAmount > 0n
                ? this.kaspaNetworkActionsService.sompiToNumber(totalAmount).toString()
                : totalPrice;
        }

        return {
            title: "List KRC721 NFT",
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
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "Price",
                    fieldValue: totalPrice + ' KAS'
                }
            ]
        }
    }

    private getKrc721CancelListActionDisplay(operationData: Krc721Send, wallet: AppWallet, action: CommitRevealAction): ActionDisplay {
        return {
            title: "Cancel KRC721 NFT Listing",
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
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "List Transaction Id",
                    fieldValue: action.options!.commitTransactionId!
                }
            ]
        }
    }
}
