import { Injectable } from "@angular/core";
import { ActionDisplay } from "../../../types/action-display.type";
import { KRC20OperationDataInterface, KRC20OperationType } from "../../../types/kaspa-network/krc20-operations-data.interface";
import { KaspaNetworkActionsService, REVEAL_PSKT_AMOUNT } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { ProtocolCompletedActionDataInterface } from "../interfaces/protocol-completed-action-data.interface";
import { CompletedActionDisplay } from "../../../types/completed-action-display.type";
import { Transaction } from "../../../../../public/kaspa/kaspa";
import { CommitRevealActionResult } from "kaspacom-wallet-messages";

@Injectable({
    providedIn: 'root',
})
export class Krc20CompletedActionDataService implements ProtocolCompletedActionDataInterface {

    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService) { }

    getActionDisplay(action: CommitRevealActionResult): CompletedActionDisplay | undefined {

        try {
            const operationData: KRC20OperationDataInterface = JSON.parse(action.protocolAction);

            switch (operationData.op) {
                case KRC20OperationType.TRANSFER:
                    return this.getKrc20TransferActionDisplay(action, operationData);
                case KRC20OperationType.MINT:
                    return this.getKrc20MintActionDisplay(action, operationData);
                case KRC20OperationType.DEPLOY:
                    return this.getKrc20DeployActionDisplay(action, operationData);
                case KRC20OperationType.LIST:
                    return this.getKrc20ListActionDisplay(action, operationData);
                case KRC20OperationType.SEND:
                    return this.getKrc20CancelListActionDisplay(action, operationData);
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

    private getKrc20TransferActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
        return {
            title: "Transfer KRC20 Token Transaction",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "From",
                    fieldValue: action.performedByWallet
                },
                {
                    fieldName: "To",
                    fieldValue: operationData.to || '-'
                },
                {
                    fieldName: "Amount",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.amt || '0'))} ${operationData.tick.toUpperCase()}`
                },
            ]
        }
    }

    private getKrc20MintActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
        return {
            title: "Mint KRC20 Token",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: action.performedByWallet
                }
            ]
        }
    }

    private getKrc20DeployActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
        return {
            title: "Deploy KRC20 Token Transaction",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: action.performedByWallet
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
                },
            ]
        }
    }

    private getKrc20ListActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
        const transaction = Transaction.deserializeFromSafeJSON(action.revealPsktJson!);

        const totalWalletOutputs = transaction.outputs
            .filter(output => this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(output.scriptPublicKey) == action.performedByWallet)
            .reduce((acc, output) => acc + output.value, 0n);

        const totalAmount = totalWalletOutputs && totalWalletOutputs > 0n ? totalWalletOutputs - REVEAL_PSKT_AMOUNT : 0n
            
        return {
            title: "List KRC20 Token Transaction",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: action.performedByWallet
                },
                {
                    fieldName: "Amount",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(BigInt(operationData.amt!)).toString()} ${operationData.tick.toUpperCase()}`
                },
                {
                    fieldName: "Price",
                    fieldValue: `${this.kaspaNetworkActionsService.sompiToNumber(totalAmount).toString()} KAS`
                },
            ]
        }
    }

    private getKrc20CancelListActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
        return {
            title: "Cancel KRC20 Token Listing",
            rows: [
                {
                    fieldName: "Ticker",
                    fieldValue: operationData.tick.toUpperCase()
                },
                {
                    fieldName: "Wallet",
                    fieldValue: action.performedByWallet,
                },
            ]
        }
    }

    // private getKrc20SendActionDisplay(action: CommitRevealActionResult, operationData: KRC20OperationDataInterface): ActionDisplay {
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

