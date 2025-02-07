import { Injectable } from "@angular/core";
import { CommitRevealAction, CompoundUtxosAction, TransferKasAction, WalletAction, WalletActionType } from "../types/wallet-action";
import { AppWallet } from "../classes/AppWallet";
import { KaspaNetworkActionsService } from "./kaspa-netwrok-services/kaspa-network-actions.service";
import { SignMessageActionInterface } from "kaspacom-wallet-messages";
import { ActionDisplay } from "../types/action-display.type";
import { BaseProtocolClassesService } from "./protocols/base-protocol-classes.service";


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
            // case WalletActionType.BUY_KRC20_PSKT:
            //     return this.getBuyKrc20PsktActionDisplay(action.data, wallet);
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
            const reviewerClass = this.baseProtocolClassesService.getClassesFor(actionData.actionScript.scriptProtocol!);

            if (reviewerClass?.actionsDataReviewer) {
                const result = reviewerClass.actionsDataReviewer.getActionDisplay(actionData, wallet);

                if (result) {
                    return result;
                }
            }
        }

        return {
            title: "Do Protocol Action",
            rows: [
                {
                    fieldName: "Wallet",
                    fieldValue: wallet.getAddress()
                },
                {
                    fieldName: "Protocol",
                    fieldValue: actionData.actionScript?.scriptProtocol || '-'
                },
                {
                    fieldName: "Action",
                    fieldValue: actionData.actionScript?.scriptDataStringify || '-',
                    isCodeBlock: true,
                }
            ]
        }
    }

    // private getBuyKrc20PsktActionDisplay(actionData: BuyKrc20PsktTransaction): ActionDisplay {
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


