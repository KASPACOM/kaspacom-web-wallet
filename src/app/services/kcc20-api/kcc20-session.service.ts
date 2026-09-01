import { Injectable, inject } from '@angular/core';
import { SignedMessageActionResult } from '@kaspacom/wallet-messages';
import { AppWallet } from '../../classes/AppWallet';
import { WalletActionService } from '../wallet-action.service';
import { WalletActionType } from '../../types/wallet-action';
import { Kcc20AuthApiService } from './kcc20-auth-api.service';

/**
 * Fixed sign-in message template, copied verbatim from kcc20-frontend's
 * src/app/utils/general.ts (generateVerificationMessage) — the backend
 * verifies the signature against this exact wording, so it can't be
 * reworded without breaking sign-in.
 */
function generateVerificationMessage(
  account: string,
  nonce: string,
  date: string,
  requestId: string,
): string {
  return `kaspa.com wants you to sign in with your Kaspa account:\n\n${account}\n\nWelcome to KaspaCom!\n\nSigning is the only way we can truly know that you are the owner of the wallet you are connecting.\nSigning is a safe, gas-less transaction that does not in any way give KaspaCom permission to perform any transactions with your wallet.\n\nURI: https://kaspa.com\n\nVersion: 1\n\nNonce: ${nonce}\n\nIssued At: ${date}\n\nRequest ID: ${requestId}`;
}

function generateRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 0xf;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures the connected wallet has an active KCC20 backend session before
 * any authenticated call (e.g. building a transfer). Signing in re-uses the
 * wallet's own message-signing action (an instant action — no extra
 * approval-dialog friction beyond the signature prompt itself) rather than
 * introducing a separate key-handling path.
 */
@Injectable({ providedIn: 'root' })
export class Kcc20SessionService {
  private readonly authApi = inject(Kcc20AuthApiService);
  private readonly walletActionService = inject(WalletActionService);

  private signedInAddress: string | undefined;
  private signInPromise: Promise<void> | undefined;

  async ensureSignedIn(wallet: AppWallet): Promise<void> {
    const address = wallet.getAddress();
    if (this.signedInAddress === address) {
      return;
    }

    if (!this.signInPromise) {
      this.signInPromise = this.signIn(wallet, address).finally(() => {
        this.signInPromise = undefined;
      });
    }
    return this.signInPromise;
  }

  private async signIn(wallet: AppWallet, address: string): Promise<void> {
    const existing = await this.authApi.getInfo();
    if (existing?.walletAddress === address) {
      this.signedInAddress = address;
      return;
    }

    const otp = await this.authApi.requestOtp(address);
    const requestId = generateRequestId();
    const date = new Date().toISOString();
    const message = generateVerificationMessage(
      address,
      otp.code,
      date,
      requestId,
    );

    const signResult = await this.walletActionService.validateAndDoActionAfterApproval(
      { type: WalletActionType.SIGN_MESSAGE, data: { message } },
      false,
    );
    if (!signResult.success || !signResult.result) {
      throw new Error('Wallet did not sign the KCC20 login message.');
    }
    const { signedMessage, publicKey } =
      signResult.result as SignedMessageActionResult;

    await this.authApi.signIn({
      walletAddress: address,
      signature: signedMessage,
      date,
      requestId,
      publicKey,
    });
    this.signedInAddress = address;
  }
}
