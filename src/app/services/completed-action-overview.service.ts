import { Injectable } from "@angular/core";
import { KaspaNetworkActionsService } from "./kaspa-netwrok-services/kaspa-network-actions.service";
import { SignedMessageActionResult, SignMessageActionInterface, WalletActionResult, WalletActionResultType } from "kaspacom-wallet-messages";
import { BaseProtocolClassesService } from "./protocols/base-protocol-classes.service";
import { CompletedActionDisplay } from "../types/completed-action-display.type";
import { CommitRevealActionResult, CompoundUtxosActionResult, KasTransferActionResult } from "../types/wallet-action-result";


@Injectable({
    providedIn: 'root',
})
export class CompletedActionOverviewService {
    constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService,
        private readonly baseProtocolClassesService: BaseProtocolClassesService,
    ) {
    }

    public getActionDisplay(action: WalletActionResult | undefined): CompletedActionDisplay | undefined {
        if (!action) {
            return undefined
        };

        switch (action?.type) {
            case WalletActionResultType.KasTransfer:
                return this.getTransferKasActionDisplay(action as KasTransferActionResult);
            case WalletActionResultType.CompoundUtxos:
                return this.getCompoundUtxosActionDisplay(action as CompoundUtxosActionResult);
            case WalletActionResultType.CommitReveal:
                return this.getCommitRevealActionDisplay(action as CommitRevealActionResult);
            // case WalletActionResultType.BUY_KRC20_PSKT:
            //     return this.getBuyKrc20PsktActionDisplay(action.data, wallet);
            case WalletActionResultType.MessageSigning:
                return this.getSignMessageActionDisplay(action as SignedMessageActionResult);
            default:
                return undefined
        }
    }

    private getTransferKasActionDisplay(actionData: KasTransferActionResult): CompletedActionDisplay {
        return {
            title: "Kas Transfer Details",
            rows: [
                {
                    fieldName: "From",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "To",
                    fieldValue: actionData.to
                },
                {
                    fieldName: "Amount",
                    fieldValue: this.kaspaNetworkActionsService.sompiToNumber(actionData.amount).toString(),
                },
                {
                    fieldName: "Transaction ID",
                    fieldValue: actionData.transactionId
                }
            ]
        }
    }

    private getCompoundUtxosActionDisplay(actionData: CompoundUtxosActionResult): CompletedActionDisplay {
        return {
            title: "Compound UTXOs",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "Transaction ID",
                    fieldValue: actionData.transactionId
                }
            ]
        }
    }

    private getSignMessageActionDisplay(actionData: SignedMessageActionResult): CompletedActionDisplay {
        return {
            title: "Message Signing Details",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: actionData.performedByWallet,
                },
                {
                    fieldName: "Message",
                    fieldValue: actionData.originalMessage,
                },
                {
                    fieldName: "Encrypted Signed Message",
                    fieldValue: actionData.signedMessage,
                }
            ]
        }
    }

    private getCommitRevealActionDisplay(actionData: CommitRevealActionResult): CompletedActionDisplay {
        let commitRevealData: CompletedActionDisplay | undefined = undefined;
        if (actionData) {
            const reviewerClass = this.baseProtocolClassesService.getClassesFor(actionData.protocol);

            if (reviewerClass?.completedActionsDataReviewer) {
                commitRevealData = reviewerClass.completedActionsDataReviewer.getActionDisplay(actionData);
            }
        }

        if (!commitRevealData) {
            commitRevealData = {
                title: "Protocol Action Completed",
                rows: [
                    {
                        fieldName: "Wallet",
                        fieldValue: actionData.performedByWallet
                    },
                    {
                        fieldName: "Protocol",
                        fieldValue: actionData.protocol
                    },
                    {
                        fieldName: "Action",
                        fieldValue: actionData.protocolAction
                    },

                ]
            }
        }



        commitRevealData.rows = [
            ...commitRevealData.rows,
            {
                fieldName: "Commit Transaction ID",
                fieldValue: actionData.commitTransactionId
            },
            {
                fieldName: "Reveal Transaction ID",
                fieldValue: actionData.revealTransactionId
            },
        ]

        return commitRevealData;
    }

    // private getBuyKrc20PsktActionDisplay(actionData: BuyKrc20PsktTransaction): CompletedActionDisplay {
    //     return {
    //         title: "Buy KRC20 Token Transaction",
    //         rows: [
    //             {
    //                 fieldName: "Wallet",
    //                 fieldValue: actionData.wallet
    //             },
    //             {
    //                 fieldName: "Amount",
    //                 fieldValue: actionData.outputs[0].value.toString()
    //             },
    //             {
    //                 fieldName: "To",
    //                 fieldValue: actionData.outputs[0].scriptPublicKey
    //             }
    //         ]
    //     }
    // }


}


