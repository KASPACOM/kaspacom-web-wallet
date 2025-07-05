import { Injectable } from "@angular/core";
import { WalletAction, WalletActionType } from "../../../types/wallet-action";
import { KRC721_TRANSACTIONS_PRICE, Krc721OperationDataService } from "./krc721-operation-data.service";
import { KaspaNetworkActionsService } from "../../kaspa-netwrok-services/kaspa-network-actions.service";
import { UtilsHelper } from "../../utils.service";
import { ProtocolType } from "kaspacom-wallet-messages/dist/types/protocol-type.enum";

const CURRENT_PROTOCOL = ProtocolType.KASPLEX;

@Injectable({
    providedIn: 'root',
})
export class Krc721WalletActionService {
    constructor(
        private krc721OperationDataService: Krc721OperationDataService,
        private kaspaNetworkActionsService: KaspaNetworkActionsService,
        private utils: UtilsHelper,
    ) { }

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
}