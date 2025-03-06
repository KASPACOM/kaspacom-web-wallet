import { Injectable } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KRC20_TRANSACTIONS_PRICE, Krc20OperationDataService } from "./krc20-operation-data.service";
import { KaspaNetworkActionsService, REVEAL_PSKT_AMOUNT } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { UtilsHelper } from "../../utils.service";
import { ProtocolType } from "kaspacom-wallet-messages/dist/types/protocol-type.enum";

const CURRENT_PROTOCOL = ProtocolType.KASPLEX;


@Injectable({
    providedIn: 'root',
})
export class Krc20WalletActionService {
    constructor(private krc20OperationDataService: Krc20OperationDataService,
        private kaspaNetworkActionsService: KaspaNetworkActionsService,
        private utils: UtilsHelper,
    ) { }

    createTransferWalletAction(ticker: string, to: string, amount: bigint): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc20OperationDataService.getTransferData(ticker, amount, to)),
                },
                options: {
                    revealPriorityFee: KRC20_TRANSACTIONS_PRICE.TRANSFER,
                }
            },
        };
    }

    createMintWalletAction(ticker: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc20OperationDataService.getMintData(ticker)),
                },
                options: {
                    revealPriorityFee: KRC20_TRANSACTIONS_PRICE.MINT,
                }
            },
        };
    }

    createDeployWalletAction(
        ticker: string,
        maxSupply: bigint,
        limitPerMint: bigint,
        preAllocation: bigint
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc20OperationDataService.getDeployData(ticker, maxSupply, limitPerMint, preAllocation)),
                },
                options: {
                    revealPriorityFee: KRC20_TRANSACTIONS_PRICE.DEPLOY,
                }
            },
        };
    }

    createListKrc20Action(
        walletAddress: string,
        ticker: string,
        amount: bigint,
        psktOutputs: {
            address: string;
            amount: bigint;
        }[],
    ): WalletAction {
        const sendData = this.krc20OperationDataService.getSendData(ticker);

        const sendScript = this.kaspaNetworkActionsService.createGenericScriptFromString(
            CURRENT_PROTOCOL,
            this.utils.stringifyProtocolAction(sendData),
            walletAddress,
        )
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc20OperationDataService.getListData(ticker, amount)),
                },
                options: {
                    additionalOutputs: [{
                        address: sendScript.scriptAddress,
                        amount: REVEAL_PSKT_AMOUNT,
                    }],
                    revealPskt: {
                        outputs: psktOutputs,
                        script: sendScript,
                    }
                }
            },
        };
    }


    createCancelListingKrc20Action(
        ticker: string,
        transactionId: string,
        amount: bigint,
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc20OperationDataService.getSendData(ticker)),
                },
                options: {
                    commitTransactionId: transactionId
                }
            },
        };
    }
}