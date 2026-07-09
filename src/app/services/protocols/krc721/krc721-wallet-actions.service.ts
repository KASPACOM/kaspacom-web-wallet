import { Injectable, inject } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KRC721_TRANSACTIONS_PRICE, Krc721OperationDataService } from "./krc721-operation-data.service";
import { KaspaNetworkActionsService, REVEAL_PSKT_AMOUNT } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { UtilsHelper } from "../../utils.service";
import { ProtocolType } from "@kaspacom/wallet-messages/dist/types/protocol-type.enum";

const CURRENT_PROTOCOL = ProtocolType.KSPR;

@Injectable({
    providedIn: 'root',
})
export class Krc721WalletActionService {
    private krc721OperationDataService = inject(Krc721OperationDataService);
    private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
    private utils = inject(UtilsHelper);


    createDeployWalletAction(
        ticker: string,
        maxSupply: string,
        limit?: string,
        preAllocation?: string,
        toAddress?: string,
        decimals?: string,
        schema?: string,
        baseUri?: string,
        startTime?: string
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.krc721OperationDataService.getDeployData(
                            ticker,
                            maxSupply,
                            limit,
                            preAllocation,
                            toAddress,
                            decimals,
                            schema,
                            baseUri,
                            startTime
                        )
                    ),
                },
                options: {
                    revealPriorityFee: KRC721_TRANSACTIONS_PRICE.DEPLOY,
                }
            },
        };
    }

    createMintWalletAction(ticker: string, toAddress?: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.krc721OperationDataService.getMintData(ticker, toAddress)
                    ),
                },
                options: {
                    revealPriorityFee: KRC721_TRANSACTIONS_PRICE.MINT,
                }
            },
        };
    }

    createTransferWalletAction(ticker: string, tokenId: string, toAddress: string): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(
                        this.krc721OperationDataService.getTransferData(ticker, tokenId, toAddress)
                    ),
                },
                options: {
                    revealPriorityFee: KRC721_TRANSACTIONS_PRICE.TRANSFER,
                }
            },
        };
    }

    createListKrc721Action(
        walletAddress: string,
        ticker: string,
        tokenId: string,
        psktOutputs: {
            address: string;
            amount: bigint;
        }[],
    ): WalletAction {
        const sendData = this.krc721OperationDataService.getSendData(ticker, tokenId);

        const sendScript = this.kaspaNetworkActionsService.createGenericScriptFromString(
            CURRENT_PROTOCOL,
            this.utils.stringifyProtocolAction(sendData),
            walletAddress,
        );

        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc721OperationDataService.getListData(ticker, tokenId)),
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

    createCancelListingKrc721Action(
        ticker: string,
        tokenId: string,
        transactionId: string,
    ): WalletAction {
        return {
            type: WalletActionType.COMMIT_REVEAL,
            data: {
                actionScript: {
                    type: CURRENT_PROTOCOL,
                    stringifyAction: this.utils.stringifyProtocolAction(this.krc721OperationDataService.getSendData(ticker, tokenId)),
                },
                options: {
                    commitTransactionId: transactionId
                }
            },
        };
    }
}
