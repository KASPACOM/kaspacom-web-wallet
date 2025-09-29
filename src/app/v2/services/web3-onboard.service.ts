import { Injectable, signal, Signal } from '@angular/core';
import Onboard, { OnboardAPI, WalletState } from '@web3-onboard/core';
import injectedModule from '@web3-onboard/injected-wallets';
import walletConnectModule from '@web3-onboard/walletconnect';
import type { EIP1193Provider } from '@web3-onboard/core';

interface ChainConfig {
  id: string;
  token: string;
  label: string;
  rpcUrl: string;
}

@Injectable({ providedIn: 'root' })
export class Web3OnboardService {
  private onboard: OnboardAPI | undefined;
  private accountSignal = signal<string | null>(null);
  private providerSignal = signal<EIP1193Provider | null>(null);

  get account(): Signal<string | null> {
    return this.accountSignal.asReadonly();
  }

  get provider(): Signal<EIP1193Provider | null> {
    return this.providerSignal.asReadonly();
  }

  init(
    chains: ChainConfig[],
    appName = 'Kaspacom Wallet',
    walletConnectProjectId?: string,
  ) {
    const injected = injectedModule();
    const wc = walletConnectModule({ projectId: walletConnectProjectId || '' });
    this.onboard = Onboard({
      wallets: [injected, wc],
      chains,
      appMetadata: { name: appName },
      connect: { autoConnectAllPreviousWallet: true },
    });
  }

  async connectWallet(): Promise<{
    address: string;
    provider: EIP1193Provider;
  } | null> {
    if (!this.onboard) throw new Error('Onboard not initialized');
    const wallets: WalletState[] | undefined =
      await this.onboard.connectWallet();
    if (!wallets || wallets.length === 0) return null;
    const wallet = wallets[0];
    const address = wallet.accounts[0]?.address;
    const provider = wallet.provider as EIP1193Provider | undefined;
    if (!address || !provider) return null;
    this.accountSignal.set(address);
    this.providerSignal.set(provider);
    return { address, provider };
  }
}
