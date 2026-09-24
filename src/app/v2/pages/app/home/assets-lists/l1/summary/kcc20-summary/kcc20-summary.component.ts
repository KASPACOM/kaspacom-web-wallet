import { Component, computed, effect, inject, signal } from '@angular/core';
import { WalletService } from '../../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../../classes/AppWallet';
import { KaspaL1NetworkService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-l1-network.service';
import {
  Kcc20Holding,
  Kcc20HoldingsService,
} from '../../../../../../../../services/covenant/kcc20-holdings.service';
import { Kcc20AssetCardComponent } from '../../asset-card/kcc20-asset-card/kcc20-asset-card.component';
import { SkeletonComponent } from '../../../../../../../shared/ui/skeleton/skeleton.component';
import {
  hex32ToBytes,
  computeBlake2bHex,
} from '../../../../../flows/contracts/crypto.util';

@Component({
  selector: 'app-kcc20-summary',
  imports: [Kcc20AssetCardComponent, SkeletonComponent],
  templateUrl: './kcc20-summary.component.html',
  styleUrl: './kcc20-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class Kcc20SummaryComponent {
  private walletService = inject(WalletService);
  private kaspaL1NetworkService = inject(KaspaL1NetworkService);
  private kcc20HoldingsService = inject(Kcc20HoldingsService);

  private static readonly SKELETON_COUNT = 4;
  loadingSkeletons: unknown[] = Array.from({
    length: Kcc20SummaryComponent.SKELETON_COUNT,
  }).map(() => ({}));

  supported = computed(() => this.kaspaL1NetworkService.supportsKcc20Assets());

  holdings = signal<Kcc20Holding[]>([]);
  loading = signal(false);
  private requestId = 0;

  constructor() {
    effect(() => {
      const wallet = this.walletService.getCurrentWalletSignal()();
      // Re-read so switching networks (different covenant indexer / no
      // KCC20 tokens there yet) triggers a reload too.
      this.kaspaL1NetworkService.getCurrentNetworkSignal()();
      this.reload(wallet);
    });
  }

  trackByHolding(index: number, holding: Kcc20Holding): string {
    return holding.covenantId;
  }

  private currentWalletPubkeyHash(wallet: AppWallet): string | undefined {
    try {
      const pubkey = wallet
        .getPrivateKey()
        .toPublicKey()
        .toXOnlyPublicKey()
        .toString();
      return computeBlake2bHex(hex32ToBytes(pubkey));
    } catch {
      return undefined;
    }
  }

  private async reload(wallet: AppWallet | undefined): Promise<void> {
    if (!wallet || !this.supported()) {
      this.holdings.set([]);
      return;
    }

    const currentRequestId = ++this.requestId;
    this.loading.set(true);
    try {
      const holdings = await this.kcc20HoldingsService.listHoldings([
        wallet.getAddress(),
        this.currentWalletPubkeyHash(wallet),
      ]);
      if (currentRequestId !== this.requestId) return;
      this.holdings.set(holdings);
    } catch (error) {
      console.error('Failed to load KCC20 holdings:', error);
      if (currentRequestId !== this.requestId) return;
      this.holdings.set([]);
    } finally {
      if (currentRequestId === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
