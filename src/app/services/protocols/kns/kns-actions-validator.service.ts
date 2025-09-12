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

        if (this.utils.isNullOrEmptyString(knsCommand.id)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for asset ID
            };
        }

        return await this.checkDomainOwnership(knsCommand.id, wallet);
    }

    private async validateInscribeKnsAction(knsCommand: KnsInscribe, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(knsCommand.id)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for asset ID
            };
        }

        // For inscribe operations with asset ID, check if the user owns the asset
        return await this.checkDomainOwnership(knsCommand.id, wallet);
    }

    private async validateUpdateKnsAction(knsCommand: KnsUpdate, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        if (this.utils.isNullOrEmptyString(knsCommand.id)) {
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER, // Reusing for asset ID
            };
        }

        return await this.checkDomainOwnership(knsCommand.id, wallet);
    }

    private async checkDomainOwnership(assetId: string, wallet: AppWallet): Promise<{ isValidated: boolean; errorCode?: number; }> {
        try {
            const assetResponse = await firstValueFrom(
                this.knsService.fetchAssetByAssetId(assetId)
            );

            if (!assetResponse.data) {
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND, // Asset not found
                };
            }

            if (assetResponse.data.owner !== wallet.getAddress()) {
                console.warn(`Asset ownership validation failed: asset "${assetId}" is owned by "${assetResponse.data.owner}" but wallet address is "${wallet.getAddress()}"`);
                return {
                    isValidated: false,
                    errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE, // Not the owner (reusing this error)
                };
            }

            return { isValidated: true };
        } catch (error) {
            console.error('Error checking asset ownership:', error);
            return {
                isValidated: false,
                errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
            };
        }
    }
}