import { Injectable, inject } from '@angular/core';
import { WalletService } from '../wallet.service';
import { WalletActionService } from '../wallet-action.service';
import {
  SignPsktTransactionAction,
  WalletActionType,
  WalletPsktSighashTypeEnum,
  WalletPsktSignInput,
} from '../../types/wallet-action';
import { WalletPsktCovenantScript } from '../covenant/covenant-sdk/types';
import { WalletActionResultWithError } from '../../types/wallet-action-result';
import { Kcc20TokenActionApiService } from './kcc20-token-action-api.service';

/**
 * The KCC20 backend sends sighash types as the standard Kaspa consensus
 * bitmask values (All=1, None=2, Single=4, +128 AnyOneCanPay), while this
 * wallet's own signing plumbing uses a 0..5 enum — kcc20-frontend's own
 * adapter does this exact remap before handing values to a connected
 * wallet. Values already in 0..5 pass through unchanged.
 */
const BACKEND_SIGHASH_TO_WALLET: Record<number, WalletPsktSighashTypeEnum> = {
  1: WalletPsktSighashTypeEnum.All,
  2: WalletPsktSighashTypeEnum.None,
  4: WalletPsktSighashTypeEnum.Single,
  129: WalletPsktSighashTypeEnum.AllAnyOneCanPay,
  130: WalletPsktSighashTypeEnum.NoneAnyOneCanPay,
  132: WalletPsktSighashTypeEnum.SingleAnyOneCanPay,
};

function toWalletSighashType(
  value: number | undefined,
): WalletPsktSighashTypeEnum | undefined {
  if (value === undefined) return undefined;
  if (value >= 0 && value <= 5) return value as WalletPsktSighashTypeEnum;
  return BACKEND_SIGHASH_TO_WALLET[value];
}

/**
 * Orchestrates a KCC20 token transfer: ask the KCC20 backend's public
 * builder for the (already-funded) transfer PSKT, then sign and broadcast
 * it. The backend owns transaction construction; this wallet only signs the
 * inputs it's told to and wraps the covenant input's signature into its
 * unlock script (applyCovenantScriptsToPsktTransaction, via the
 * SIGN_PSKT_TRANSACTION action's `scripts` field).
 */
@Injectable({ providedIn: 'root' })
export class Kcc20TransferService {
  private readonly walletService = inject(WalletService);
  private readonly walletActionService = inject(WalletActionService);
  private readonly kcc20TokenActionApiService = inject(
    Kcc20TokenActionApiService,
  );

  async transfer(
    covenantId: string,
    tokenAmount: string,
    recipientOwner: string,
  ): Promise<WalletActionResultWithError> {
    const wallet = this.walletService.getCurrentWallet();
    if (!wallet) {
      throw new Error('Connect a wallet before transferring KCC20 tokens.');
    }

    const built = await this.kcc20TokenActionApiService.buildTransfer(
      covenantId,
      { tokenAmount, recipientOwner, walletAddress: wallet.getAddress() },
    );

    const signing = built.payload.signing;
    if (signing?.status !== 'ready-to-sign' || !signing.psktTransactionJson) {
      throw new Error(
        signing?.builderError ||
          'KCC20 backend did not return a signable transfer transaction.',
      );
    }

    const signInputs: WalletPsktSignInput[] = (signing.signInputs ?? []).map(
      (input) => ({
        index: input.index,
        sighashType: toWalletSighashType(input.sighashType),
      }),
    );
    const scripts: WalletPsktCovenantScript[] | undefined =
      signing.scripts?.map((script) => ({
        inputIndex: script.inputIndex,
        scriptHex: script.scriptHex,
        signatureScript: script.signatureScript,
      }));

    const action: { type: WalletActionType.SIGN_PSKT_TRANSACTION; data: SignPsktTransactionAction } = {
      type: WalletActionType.SIGN_PSKT_TRANSACTION,
      data: {
        psktTransactionJson: signing.psktTransactionJson,
        signOnly: true,
        signInputs,
        scripts,
        submitTransaction: true,
      },
    };

    return this.walletActionService.validateAndDoActionAfterApproval(
      action,
      false,
    );
  }
}
