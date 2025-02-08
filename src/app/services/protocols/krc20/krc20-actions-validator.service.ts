import { Injectable } from "@angular/core";
import { ProtocolActionsValidatorInterface } from "../interfaces/protocol-actions-validator.interface";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { KRC20OperationDataInterface, KRC20OperationType } from "../../../types/kaspa-network/krc20-operations-data.interface";
import { ERROR_CODES } from "kaspacom-wallet-messages";
import { UtilsHelper } from "../../utils.service";
import { firstValueFrom } from "rxjs";
import { KasplexKrc20Service } from "../../kasplex-api/kasplex-api.service";
import { TokenState } from "../../kasplex-api/dtos/token-list-info.dto";


@Injectable({
    providedIn: 'root',
})
export class Krc20ActionsValidatorService implements ProtocolActionsValidatorInterface {
    constructor(private readonly utils: UtilsHelper, private readonly kasplexService: KasplexKrc20Service) { }

    async validateCommitRevealAction(action: CommitRevealAction, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        try {
            const data = JSON.parse(action.actionScript.scriptDataStringify) as KRC20OperationDataInterface;

            switch (data.op) {
                case KRC20OperationType.TRANSFER:
                    return await this.validateTransferKrc20Action(data, wallet);
                case KRC20OperationType.MINT:
                    return await this.validateMintKrc20Action(data, wallet);
                case KRC20OperationType.DEPLOY:
                    return await this.validateDeployKrc20Action(data, wallet);
                case KRC20OperationType.LIST:
                    return await this.validateListKrc20Action(data, wallet);
            }
        } catch (error) {
            console.error(error);
        }

        return {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
        };
    }

    private async validateTransferKrc20Action(krc20Command: KRC20OperationDataInterface,
        wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(krc20Command.to!)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
            };
        }

        if (!this.utils.isValidWalletAddress(krc20Command.to!)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
            };
        }

        if (!krc20Command.amt) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
            }
        }

        return await this.checkWalletBalance(krc20Command.tick, krc20Command.amt!, wallet);
    }

    private async validateMintKrc20Action(krc20Command: KRC20OperationDataInterface, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        let tokenData;

        try {
            tokenData = await firstValueFrom(
                this.kasplexService.getTokenInfo(krc20Command.tick)
            );
        } catch (error) {
            console.error(error);

            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }

        if (!tokenData.result?.[0]) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND,
            };
        }

        if (tokenData.result[0].state != TokenState.DEPLOYED) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.TOKEN_NOT_IN_MINTABLE_STATE,
            };
        }

        return {
            isValidated: true,
        };
    }

    private async validateListKrc20Action(krc20Command: KRC20OperationDataInterface, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(krc20Command.amt!)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
            };
        }

        if (BigInt(krc20Command.amt!) <= 0n) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
            };
        }

        // TODO: IMPLEMENT
        // if (!(action.psktData?.totalPrice && action.psktData.totalPrice > 0n)) {
        //     return {
        //         isValidated: false,
        //         errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
        //     };
        // }

        if (!krc20Command.amt) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT,
            }
        }

        return { isValidated: true };
    }

    private async validateDeployKrc20Action(krc20Command: KRC20OperationDataInterface, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (
            this.utils.isNullOrEmptyString(krc20Command.tick) ||
            this.utils.isNullOrEmptyString(krc20Command.max) ||
            this.utils.isNullOrEmptyString(krc20Command.lim) ||
            this.utils.isNullOrEmptyString(krc20Command.pre) ||
            !this.utils.isNumberString(krc20Command.max!) ||
            !this.utils.isNumberString(krc20Command.lim!) ||
            !this.utils.isNumberString(krc20Command.pre!)
        ) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
            };
        }

        if (
            BigInt(krc20Command.max!) <= 0n ||
            BigInt(krc20Command.lim!) <= 0n ||
            BigInt(krc20Command.max!) < BigInt(krc20Command.lim!) ||
            BigInt(krc20Command.max!) < BigInt(krc20Command.pre!) ||
            (BigInt(krc20Command.pre!) &&
                (BigInt(krc20Command.pre!) < 0n ||
                    BigInt(krc20Command.pre!) >
                    BigInt(krc20Command.max!)))
        ) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
            };
        }

        if (
            !(
                krc20Command.tick.length >= 4 &&
                krc20Command.tick.length <= 6
            )
        ) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
            };
        }

        let tickerInfoResult;

        try {
            tickerInfoResult = await firstValueFrom(
                this.kasplexService.getTokenInfo(krc20Command.tick)
            );
        } catch (error) {
            console.error(error);

            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }

        if (!tickerInfoResult.result?.[0]) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }

        const tickerData = tickerInfoResult.result?.[0];

        if (tickerData.state != TokenState.UNUSED) {
            return {
                isValidated: false,
                errorCode:
                    ERROR_CODES.WALLET_ACTION.TOKEN_NAME_IS_NOT_AVAILABLE_TO_DEPLOY,
            };
        }

        return { isValidated: true };
    }


    private async checkWalletBalance(ticker: string, amount: string, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        let currentBalance;

        try {
            const response = await firstValueFrom(
                this.kasplexService.getTokenWalletBalanceInfo(
                    wallet.getAddress(),
                    ticker
                )
            );

            if (!response?.result?.[0]) {
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
                };
            }

            currentBalance = response.result[0];
        } catch (error) {
            console.error(error);

            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }

        if (!currentBalance) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
            };
        }

        if (
            BigInt(currentBalance.balance) < BigInt(amount || '0')
        ) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
            };
        }

        return { isValidated: true };
    }

}




// Validation of PSKT for send

// const sendTransactionId = transaction.inputs?.[0]?.transactionId;
// const sellerWalletAddressScript = transaction.outputs?.[0]?.scriptPublicKey;

// if (!(sendTransactionId && sellerWalletAddressScript)) {
//   return {
//     isValidated: false,
//     errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
//   };
// }

// let sellerWalletAddress: string;

// try {
//   sellerWalletAddress =
//     this.kaspaNetworkActionsService.getWalletAddressFromScriptPublicKey(
//       sellerWalletAddressScript
//     );
// } catch (error) {
//   return {
//     isValidated: false,
//     errorCode: ERROR_CODES.WALLET_ACTION.INVALID_PSKT_TX,
//   };
// }

// let operationDetails: OperationDetailsResponse;

// try {
//   operationDetails = await firstValueFrom(
//     this.kasplexService.getOperationDetails(sendTransactionId)
//   );
// } catch (error) {
//   console.error(error);

//   return {
//     isValidated: false,
//     errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
//   };
// }

// if (!operationDetails?.result?.[0]) {
//   return {
//     isValidated: false,
//     errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
//   };
// }

// try {
//   const isTransactionStillExists =
//     await this.kasplexService.isListingStillExists(
//       operationDetails.result[0].tick,
//       sellerWalletAddress,
//       sendTransactionId
//     );

//   if (!isTransactionStillExists) {
//     return {
//       isValidated: false,
//       errorCode: ERROR_CODES.WALLET_ACTION.SEND_TRANSACTION_ALREADY_SPENT,
//     };
//   }
// } catch (error) {
//   console.error(error);

//   return {
//     isValidated: false,
//     errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
//   };
// }