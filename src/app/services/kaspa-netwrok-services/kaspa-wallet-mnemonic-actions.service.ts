import { Injectable, inject } from '@angular/core';
import { Mnemonic, PrivateKey, XPrv } from '../../../../public/kaspa/kaspa';
import { DEFAULT_DERIVED_PATH } from '../../config/consts';
import { RpcService } from './rpc.service';

@Injectable({
  providedIn: 'root',
})
export class KaspaWalletMnemonicActionsService {
  private rpcService = inject(RpcService);

  getPrivateKeyFromMnemonic(
    mnemonicWords: string,
    derivedPath: string = DEFAULT_DERIVED_PATH,
    password?: string,
  ): string | null {
    const isValid = Mnemonic.validate(mnemonicWords);

    if (!isValid) {
      return null;
    }

    try {
      const mnemonic = new Mnemonic(mnemonicWords);

      const seed = mnemonic.toSeed(password);
      const xprv = new XPrv(seed);

      if (derivedPath) {
        return xprv.derivePath(derivedPath).toPrivateKey().toString();
      }

      return xprv.privateKey;
    } catch {
      // The original error is dropped rather than wrapped: these WASM calls
      // receive the phrase, seed and extended key, and an error echoing any of
      // them would reach Sentry through the global handler.
      throw new Error('Failed to derive a private key from the mnemonic');
    }
  }

  getWalletAddressFromMnemonic(
    mnemonic: string,
    password?: string,
  ): string | null {
    const privateKey = this.getPrivateKeyFromMnemonic(
      mnemonic,
      DEFAULT_DERIVED_PATH,
      password,
    );
    return privateKey ? this.convertPrivateKeyToAddress(privateKey) : null;
  }

  convertPrivateKeyToAddress(privateKey: string): string {
    return new PrivateKey(privateKey)
      .toPublicKey()
      .toAddress(this.rpcService.getNetwork())
      .toString();
  }

  getPublicKey(privateKey: string): string {
    return new PrivateKey(privateKey).toPublicKey().toString();
  }

  validatePrivateKey(privateKey: string) {
    try {
      new PrivateKey(privateKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  generateMnemonic(wordsCount: number): string {
    return Mnemonic.random(wordsCount).phrase;
  }
}
