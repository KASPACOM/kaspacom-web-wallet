import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import type { EIP1193Provider } from '@web3-onboard/core';
import { formatUnits } from 'ethers';
import { Web3OnboardService } from './web3-onboard.service';
import { NetworkService } from './network.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class L2WalletService {
  private web3 = inject(Web3OnboardService);
  private network = inject(NetworkService);

  private l2NativeBalanceSignal = signal<string | null>(null);

  l2NativeBalance: Signal<string | null> =
    this.l2NativeBalanceSignal.asReadonly();

  async ensureConnected(): Promise<boolean> {
    // Initialize Web3 Onboard with Kasplex chain for now
    this.web3.init([
      {
        id: `0x${environment.l2Configs.kasplex.chainId.toString(16)}`,
        token: environment.l2Configs.kasplex.nativeCurrency.symbol,
        label: environment.l2Configs.kasplex.name,
        rpcUrl: environment.l2Configs.kasplex.rpcUrls.default.http[0],
      },
    ]);

    const result = await this.web3.connectWallet();
    return !!result;
  }

  async refreshL2NativeBalance(): Promise<void> {
    const provider = this.web3.provider();
    const address = this.web3.account();
    if (!provider || !address) {
      this.l2NativeBalanceSignal.set(null);
      return;
    }
    const eip: EIP1193Provider | null = provider;
    const raw = await eip.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    });
    const value = BigInt(raw as string);
    const decimals = environment.l2Configs.kasplex.nativeCurrency.decimals;
    this.l2NativeBalanceSignal.set(formatUnits(value, decimals));
  }
}
