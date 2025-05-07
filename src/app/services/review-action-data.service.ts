import { Injectable } from "@angular/core";
import { CommitRevealAction, CompoundUtxosAction, SignL2EtherTransactionAction, SignPsktTransactionAction, SubmitTransactionAction, TransferKasAction, WalletAction, WalletActionType } from "../types/wallet-action";
import { AppWallet } from "../classes/AppWallet";
import { KaspaNetworkActionsService } from "./kaspa-netwrok-services/kaspa-network-actions.service";
import { SignMessageActionInterface } from "kaspacom-wallet-messages";
import { ActionDisplay } from "../types/action-display.type";
import { BaseProtocolClassesService } from "./protocols/base-protocol-classes.service";
import { kaspaToSompi, Transaction } from "../../../public/kaspa/kaspa";


@Injectable({
    providedIn: 'root',
})
export class ReviewActionDataService {
    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly baseProtocolClassesService: BaseProtocolClassesService,
    ) {
    }

    public getActionDisplay(action: WalletAction | undefined, wallet: AppWallet): ActionDisplay | undefined {
        if (!action) {
            return undefined
        };

        switch (action?.type) {
            case WalletActionType.TRANSFER_KAS:
                return this.getTransferKasActionDisplay(action.data, wallet);
            case WalletActionType.COMPOUND_UTXOS:
                return this.getCompoundUtxosActionDisplay(action.data, wallet);
            case WalletActionType.COMMIT_REVEAL:
                return this.getCommitRevealActionDisplay(action.data, wallet);
            case WalletActionType.SIGN_PSKT_TRANSACTION:
                return this.getSignPsktTransactionActionDisplay(action.data, wallet);
            case WalletActionType.SIGN_L2_ETHER_TRANSACTION:
                return this.getSignL2EtherTransactionActionDisplay(action.data, wallet);
            case WalletActionType.SIGN_MESSAGE:
                return this.getSignMessageActionDisplay(action.data, wallet);
            default:
                return undefined
        }
    }

    private getTransferKasActionDisplay(actionData: TransferKasAction, wallet: AppWallet): ActionDisplay {
        return {
            title: "Transfer KAS",
            rows: [
                {
                    fieldName: "Sender",
                    fieldValue: wallet.getAddress(),
                },
                {
                    fieldName: "Recipient",
                    fieldValue: actionData.to
                },
                {
                    fieldName: "Amount",
                    fieldValue: this.kaspaNetworkActionsService.sompiToNumber(actionData.amount).toString()
                }
            ]
        }
    }

    private getCompoundUtxosActionDisplay(actionData: CompoundUtxosAction, wallet: AppWallet): ActionDisplay {
        return {
            title: "Compound UTXOs",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress(),
                }
            ]
        }
    }

    private getSignMessageActionDisplay(actionData: SignMessageActionInterface, wallet: AppWallet): ActionDisplay {
        return {
            title: "Signature Request",
            subtitle: "This action is gas free and will not cost you anything, or give any permission to the requested entity.",
            rows: [
                {
                    fieldName: "Wallet Address",
                    fieldValue: wallet.getAddress(),
                },
                {
                    fieldName: "Message",
                    fieldValue: actionData.message,
                    isCodeBlock: true
                }
            ]
        }
    }

    private getCommitRevealActionDisplay(actionData: CommitRevealAction, wallet: AppWallet): ActionDisplay {
        if (actionData) {
            const reviewerClass = this.baseProtocolClassesService.getClassesFor(actionData.actionScript.type!);

            if (reviewerClass?.actionsDataReviewer) {
                const result = reviewerClass.actionsDataReviewer.getActionDisplay(actionData, wallet);

                if (result) {
                    return result;
                }
            }
        }

        const result = {
            title: "Do Protocol Action",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "Protocol",
                    fieldValue: actionData.actionScript?.type || '-'
                },
                {
                    fieldName: "Action",
                    fieldValue: actionData.actionScript?.stringifyAction || '-',
                    isCodeBlock: true,
                }
            ]
        }

        if (actionData.options?.commitTransactionId) {
            result.rows.push({
                fieldName: "Commit Transaction ID",
                fieldValue: actionData.options?.commitTransactionId
            })
        }

        if (actionData.options?.additionalOutputs?.length) {
            result.rows.push({
                fieldName: "Additional Payments Amount",
                fieldValue: actionData.options?.additionalOutputs?.reduce((sum, out) => sum + this.kaspaNetworkActionsService.sompiToNumber(out.amount), 0).toString() + ' KAS',
            });
            result.rows.push({
                fieldName: "Additional Payments Details",
                fieldValue: actionData.options?.additionalOutputs?.map(out => `${out.address}: ${this.kaspaNetworkActionsService.sompiToNumber(out.amount)} KAS`).join('\n') || '-',
                isCodeBlock: true,

            });
        }

        return result;
    }

    private getSignPsktTransactionActionDisplay(actionData: SignPsktTransactionAction, wallet: AppWallet): ActionDisplay {
        const transactionData = Transaction.deserializeFromSafeJSON(actionData.psktTransactionJson);

        const inputsSum = transactionData.inputs.reduce((sum, input) => sum + input.utxo!.amount, 0n);

        if (inputsSum > 0n && transactionData.outputs[0]) {
            transactionData.outputs[0].value = transactionData.outputs[0].value - inputsSum;
        }

        return {
            title: `Sign${actionData.submitTransaction ? ' & Submit' : ''} PSKT Transaction`,
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress(),
                },
                {
                    fieldName: "Payments",
                    fieldValue: transactionData.outputs.map(output => `${this.kaspaNetworkActionsService.sompiToNumber(output.value)} KAS to ${this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(output.scriptPublicKey)}`).join('\n')
                }
            ]
        }
    }

    private getSignL2EtherTransactionActionDisplay(actionData: SignL2EtherTransactionAction, wallet: AppWallet): ActionDisplay {
        return {
            title: `${actionData.submitTransaction ? 'Submit' : 'Sign'} L2 Ether Transaction`,
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress(),
                },
                {
                    fieldName: "L2 Wallet Address",
                    fieldValue: wallet.getL2WalletStateSignal()()?.address || '-',
                },
                {
                    fieldName: "Send Kaspa Transaction",
                    fieldValue: actionData.sendToL1 ? 'Yes' : 'No',
                },
                {
                    fieldName: "Transaction",
                    fieldValue: JSON.stringify(actionData.transactionOptions, null, 2),
                    isCodeBlock: true,
                }
            ]
        }
    }

    // private getSubmitTransactionActionDisplay(actionData: SubmitTransactionAction, wallet: AppWallet): ActionDisplay {
    //     const transactionData = Transaction.deserializeFromSafeJSON(actionData.transactionJson);

    //     const totalOutputs = transactionData.outputs

    //     return {
    //         title: 'Submit Transaction',
    //         rows: [
    //             {
    //                 fieldName: "Wallet",
    //                 fieldValue: wallet.getAddress(),
    //             },
    //             {
    //                 fieldName: "Inputs",
    //                 fieldValue: transactionData.inputs.map(input => `${this.kaspaNetworkActionsService.sompiToNumber(input.utxo!.amount)} KAS to ${this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(input.signatureScript)}`).join('\n')

    //             },
    //             {
    //                 fieldName: "Payments",
    //                 fieldValue: transactionData.outputs.map(output => `${this.kaspaNetworkActionsService.sompiToNumber(output.value)} KAS to ${this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(output.scriptPublicKey)}`).join('\n')
    //             }
    //         ]
    //     }
    // }
}
