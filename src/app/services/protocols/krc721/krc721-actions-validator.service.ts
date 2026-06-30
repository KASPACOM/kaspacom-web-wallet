import { Injectable } from '@angular/core';
import { ProtocolActionsValidatorInterface } from '../interfaces/protocol-actions-validator.interface';
import { AppWallet } from '../../../classes/AppWallet';
import { CommitRevealAction } from '../../../types/wallet-action';
import {
  Krc721OperationType,
  Krc721Deploy,
  Krc721Mint,
  Krc721Transfer,
  Krc721List,
  Krc721Send,
} from '../../../types/kaspa-network/krc721-operations-data.interface';
import { ERROR_CODES } from '@kaspacom/wallet-messages';
import { UtilsHelper } from '../../utils.service';
import { firstValueFrom } from 'rxjs';
import { Krc721ApiService } from '../../krc721-api/krc721-api.service';

@Injectable({
  providedIn: 'root',
})
export class Krc721ActionsValidatorService implements ProtocolActionsValidatorInterface {
  constructor(
    private readonly utils: UtilsHelper,
    private readonly krc721Service: Krc721ApiService,
  ) {}

  async validateCommitRevealAction(
    action: CommitRevealAction,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    try {
      const data = JSON.parse(action.actionScript.stringifyAction) as
        | Krc721Deploy
        | Krc721Mint
        | Krc721Transfer
        | Krc721List
        | Krc721Send;

      switch (data.op) {
        case Krc721OperationType.TRANSFER:
          return await this.validateTransferKrc721Action(
            data as Krc721Transfer,
            wallet,
          );
        case Krc721OperationType.MINT:
          return await this.validateMintKrc721Action(
            data as Krc721Mint,
            wallet,
          );
        case Krc721OperationType.DEPLOY:
          return await this.validateDeployKrc721Action(
            data as Krc721Deploy,
            wallet,
          );
        case Krc721OperationType.LIST:
          return await this.validateListKrc721Action(
            data as Krc721List,
            wallet,
          );
        case Krc721OperationType.SEND:
          return this.validateSendKrc721Action(data as Krc721Send, action);
      }
    } catch (error) {
      console.error(error);
    }

    return {
      isValidated: false,
      errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ACTION_TYPE,
    };
  }

  private async validateTransferKrc721Action(
    krc721Command: Krc721Transfer,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (this.utils.isNullOrEmptyString(krc721Command.to)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
      };
    }

    if (!this.utils.isValidWalletAddress(krc721Command.to)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_ADDRESS,
      };
    }

    if (this.utils.isNullOrEmptyString(krc721Command.tick)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
      };
    }

    if (this.utils.isNullOrEmptyString(krc721Command.tokenId)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT, // Reusing this for invalid token ID
      };
    }

    const ownershipValidation = await this.checkNftOwnership(
      krc721Command.tick,
      krc721Command.tokenId,
      wallet,
    );
    if (!ownershipValidation.isValidated) {
      return ownershipValidation;
    }

    return await this.checkNftIsTransferable(
      krc721Command.tick,
      krc721Command.tokenId,
      wallet,
    );
  }

  private async validateMintKrc721Action(
    krc721Command: Krc721Mint,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (this.utils.isNullOrEmptyString(krc721Command.tick)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
      };
    }

    // Check if the collection exists and is mintable
    try {
      const collectionData = await firstValueFrom(
        this.krc721Service.getCollectionDetails(krc721Command.tick),
      );

      if (!collectionData.result) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND,
        };
      }

      // Additional validation can be added here based on collection state
      // For now, we'll assume if the collection exists, it can be minted
      return {
        isValidated: true,
      };
    } catch (error) {
      console.error(error);
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.KASPLEX_API_ERROR,
      };
    }
  }

  private async validateDeployKrc721Action(
    krc721Command: Krc721Deploy,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    if (this.utils.isNullOrEmptyString(krc721Command.tick)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
      };
    }

    if (
      this.utils.isNullOrEmptyString(krc721Command.max) ||
      !this.utils.isNumberString(krc721Command.max)
    ) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
      };
    }

    if (BigInt(krc721Command.max) <= 0n) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_DEPLOY_DATA,
      };
    }

    if (!(krc721Command.tick.length >= 4 && krc721Command.tick.length <= 6)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
      };
    }

    // Check if ticker is already in use
    try {
      const collectionData = await firstValueFrom(
        this.krc721Service.getCollectionDetails(krc721Command.tick),
      );

      if (collectionData.result) {
        return {
          isValidated: false,
          errorCode:
            ERROR_CODES.WALLET_ACTION.TOKEN_NAME_IS_NOT_AVAILABLE_TO_DEPLOY,
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

  private async validateListKrc721Action(
    krc721Command: Krc721List,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    const baseValidation = this.validateTickerAndTokenId(krc721Command);

    if (!baseValidation.isValidated) {
      return baseValidation;
    }

    return await this.checkNftOwnership(
      krc721Command.tick,
      krc721Command.tokenId,
      wallet,
    );
  }

  private validateSendKrc721Action(
    krc721Command: Krc721Send,
    action: CommitRevealAction,
  ): { isValidated: boolean; errorCode?: number } {
    const baseValidation = this.validateTickerAndTokenId(krc721Command);

    if (!baseValidation.isValidated) {
      return baseValidation;
    }

    if (this.utils.isNullOrEmptyString(action.options?.commitTransactionId)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.REVEAL_WITH_NO_COMMIT_ACTION,
      };
    }

    return { isValidated: true };
  }

  private validateTickerAndTokenId(krc721Command: Krc721List | Krc721Send): {
    isValidated: boolean;
    errorCode?: number;
  } {
    if (this.utils.isNullOrEmptyString(krc721Command.tick)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_TICKER,
      };
    }

    if (this.utils.isNullOrEmptyString(krc721Command.tokenId)) {
      return {
        isValidated: false,
        errorCode: ERROR_CODES.WALLET_ACTION.INVALID_AMOUNT, // Reusing this for invalid token ID
      };
    }

    return { isValidated: true };
  }

  private async checkNftOwnership(
    ticker: string,
    tokenId: string,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    try {
      const nftData = await firstValueFrom(
        this.krc721Service.getTokenDetails(ticker, tokenId),
      );

      if (!nftData.result) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.TICKER_NOT_FOUND,
        };
      }

      const nft = nftData.result;
      if (nft.owner !== wallet.getAddress()) {
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

  private async checkNftIsTransferable(
    ticker: string,
    tokenId: string,
    wallet: AppWallet,
  ): Promise<{ isValidated: boolean; errorCode?: number }> {
    try {
      const portfolioDetails = await firstValueFrom(
        this.krc721Service.getPortfolioDetails(wallet.getAddress(), ticker),
      );

      const portfolioItem = portfolioDetails.find(
        (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
      );
      const isListed = portfolioItem?.listedTokenIds?.some(
        (listedTokenId) => listedTokenId.toString() === tokenId.toString(),
      );

      if (isListed) {
        return {
          isValidated: false,
          errorCode: ERROR_CODES.WALLET_ACTION.INSUFFICIENT_BALANCE,
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
