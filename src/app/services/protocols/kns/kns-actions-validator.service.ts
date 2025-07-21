import { Injectable } from "@angular/core";
import { ProtocolActionsValidatorInterface } from "../interfaces/protocol-actions-validator.interface";
import { AppWallet } from "../../../classes/AppWallet";
import { CommitRevealAction } from "../../../types/wallet-action";
import { KnsOperationType, KnsInscribe, KnsTransfer, KnsUpdate } from "../../../types/kaspa-network/kns-operations-data.interface";
import { ERROR_CODES } from "@kaspacom/wallet-messages";
import { UtilsHelper } from "../../utils.service";
import { firstValueFrom } from "rxjs";
import { KnsApiService } from "../../kns-api/kns-api.service";

@Injectable({
    providedIn: 'root',
})
export class KnsActionsValidatorService implements ProtocolActionsValidatorInterface {
    constructor(
        private readonly utils: UtilsHelper, 
        private readonly knsService: KnsApiService
    ) { }

    async validateCommitRevealAction(action: CommitRevealAction, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        try {
            const data = JSON.parse(action.actionScript.stringifyAction) as KnsInscribe | KnsTransfer | KnsUpdate;

            switch (data.op) {
                case KnsOperationType.TRANSFER:
                    return await this.validateTransferKnsAction(data as KnsTransfer, wallet);
                case KnsOperationType.INSCRIBE:
                    return await this.validateInscribeKnsAction(data as KnsInscribe, wallet);
                case KnsOperationType.UPDATE:
                    return await this.validateUpdateKnsAction(data as KnsUpdate, wallet);
            }
        } catch (error) {
            console.error(error);
        }

        return {
            isValidated: false,
            errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
        };
    }

    private async validateTransferKnsAction(knsCommand: KnsTransfer, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(knsCommand.to)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
            };
        }

        if (!this.utils.isValidWalletAddress(knsCommand.to)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
            };
        }

        if (this.utils.isNullOrEmptyString(knsCommand.name)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for domain name
            };
        }

        return await this.checkDomainOwnership(knsCommand.name, wallet);
    }

    private async validateInscribeKnsAction(knsCommand: KnsInscribe, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(knsCommand.name)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for domain name
            };
        }

        // Check if domain name is available by searching for it
        try {
            const domainData = await firstValueFrom(
                this.knsService.fetchAssets(1, 1, undefined, undefined, undefined, knsCommand.name)
            );

            if (domainData.data && domainData.data.assets.length > 0) {
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.TOKEN_NAME_IS_NOT_AVAILABLE_TO_DEPLOY,
                };
            }

            return { isValidated: true };
        } catch (error) {
            console.error(error);
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }
    }

    private async validateUpdateKnsAction(knsCommand: KnsUpdate, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(knsCommand.name)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for domain name
            };
        }

        return await this.checkDomainOwnership(knsCommand.name, wallet);
    }

    private async checkDomainOwnership(domainName: string, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        try {
            const domainData = await firstValueFrom(
                this.knsService.fetchAssets(1, 1, undefined, undefined, undefined, domainName)
            );

            if (!domainData.data || domainData.data.assets.length === 0) {
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND,
                };
            }

            const domain = domainData.data.assets[0];
            if (domain.owner !== wallet.getAddress()) {
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE, // Reusing this for "not owner"
                };
            }

            return { isValidated: true };
        } catch (error) {
            console.error(error);
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }
    }
}