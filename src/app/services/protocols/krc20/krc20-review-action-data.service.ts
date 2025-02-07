import { Injectable } from "@angular/core";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { ActionDisplay } from "../../../types/action-display.type";
import { KRC20OperationDataInterface, KRC20OperationType } from "../../../types/kaspa-network/krc20-operations-data.interface";
import { KaspaNetworkActionsService } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { ProtocolReviewActionDataInterface } from "../interfaces/protocol-review-action-data.interface copy";

@Injectable({
    providedIn: 'root',
})
export class Krc20ReviewActionDataService implements ProtocolReviewActionDataInterface {

    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService) { }

    getActionDisplay(action: CommitRevealAction | undefined, wallet: AppWallet): ActionDisplay | undefined {

        if (!action?.actionScript.scriptDataStringify) {
            return undefined;
        }

        try {
            const operationData: KRC20OperationDataInterface = JSON.parse(action.actionScript.scriptDataStringify);

            switch (operationData.op) {
                case KRC20OperationType.TRANSFER:
                    return this.getKrc20TransferActionDisplay(operationData, wallet);
                case KRC20OperationType.MINT:
                    return this.getKrc20MintActionDisplay(operationData, wallet);
                case KRC20OperationType.DEPLOY:
                    return this.getKrc20DeployActionDisplay(operationData, wallet);
                case KRC20OperationType.LIST:
                    return this.getKrc20ListActionDisplay(operationData, wallet, action);
                case KRC20OperationType.SEND:
                    if (!action.options?.additionalOutputs) {
                        return this.getKrc20CancelListActionDisplay(operationData, wallet, action);
                    }
                // if (operationData.isCancel) {
                //     return this.getKrc20CancelListActionDisplay(operationData, wallet);
                // } else {
                //     return this.getKrc20SendActionDisplay(operationData, wallet);
                // }
            }

        } catch (error) {
            console.error(error);
        }

        return undefined;
    }

    private getKrc20TransferActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet): ActionDisplay {
        return {
            title: "Transfer KRC20 Token",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Sender",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "Recipient",
                    fieldValue: operationData.to! || '-'
                },
                {
                    fieldName: "Amount",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.amt || '0'))} ${operationData.tick.toUpperCase()}`
                }
            ]
        }
    }

    private getKrc20MintActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet): ActionDisplay {
        return {
            title: "Mint KRC20 Token",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                }
            ]
        }
    }

    private getKrc20DeployActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet): ActionDisplay {
        return {
            title: "Deploy KRC20 Token",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Max Supply",
                    fieldValue: this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.max!)).toString()
                },
                {
                    fieldName: "Tokens Per Mint",
                    fieldValue: this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.lim!)).toString()
                },
                {
                    fieldName: "Pre Allocation",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.pre!)).toString()} (${(Number(operationData.pre!) / Number(operationData.max!) * 100).toFixed(2)}%)`
                }
            ]
        }
    }

    private getKrc20ListActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet, action: CommitRevealAction): ActionDisplay {
        let totalPrice = "Unknown";

        if (action.options?.revealPskt) {
            const totalAmount = action.options?.revealPskt?.outputs
                ?.filter(output => output.address == wallet.getAddress())
                .reduce((acc, output) => acc + output.amount, 0n);

            totalPrice = totalAmount && totalAmount > 0n ? this.kaspaNetworkActionsService.sompiToNumber(totalAmount).toString() : totalPrice;
        }

        return {
            title: "List KRC20 Token",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "Amount",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.amt!)).toString()} ${operationData.tick.toUpperCase()}`
                },
                {
                    fieldName: "Price",
                    fieldValue: totalPrice + ' KAS',
                }
            ]
        }
    }

    private getKrc20CancelListActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet, action: CommitRevealAction): ActionDisplay {
        return {
            title: "Cancel KRC20 Token Listing",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "List Transaction Id",
                    fieldValue: action.options!.commitTransactionId!,
                }
            ]
        }
    }

    // private getKrc20SendActionDisplay(operationData: KRC20OperationDataInterface, wallet: AppWallet): ActionDisplay {
    //     return {
    //         title: "Send KRC20 Token",
    //         rows: [
    //             {
    //                 fieldName: "Ticker",
    //                 fieldValue: operationData.tick.toUpperCase()
    //             },
    //             {
    //                 fieldName: "Sender",
    //                 fieldValue: wallet.getAddress()
    //             },
    //             {
    //                 fieldName: "Recipient",
    //                 fieldValue: operationData.to
    //             },
    //             {
    //                 fieldName: "Amount",
    //                 fieldValue: operationData.amt!.toString()
    //             }
    //         ]
    //     }
    // }


}

