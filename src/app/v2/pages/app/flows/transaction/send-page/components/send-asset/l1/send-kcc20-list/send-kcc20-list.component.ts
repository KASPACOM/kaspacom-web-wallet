import { Component, effect, inject, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { SkeletonComponent } from '../../../../../../../../../shared/ui/skeleton';
import { WalletService } from '../../../../../../../../../../services/wallet.service';
import { AppWallet } from '../../../../../../../../../../classes/AppWallet';
import {
  Kcc20Holding,
  Kcc20HoldingsService,
} from '../../../../../../../../../../services/covenant/kcc20-holdings.service';
import { Kcc20TokenLogoComponent } from '../../../../../../../home/assets-lists/l1/logo/kcc20-token-logo/kcc20-token-logo.component';
import {
  hex32ToBytes,
  computeBlake2bHex,
} from '../../../../../../contracts/crypto.util';

@Component({
  selector: 'app-send-kcc20-list',
  standalone: true,
  imports: [
    DecimalPipe,
    TitleCasePipe,
    UpperCasePipe,
    SkeletonComponent,
    Kcc20TokenLogoComponent,
  ],
  templateUrl: './send-kcc20-list.component.html',
  styleUrl: './send-kcc20-list.component.scss',
})
export class SendKcc20ListComponent extends FlowPageBaseComponent {
  private walletService = inject(WalletService);
  private kcc20HoldingsService = inject(Kcc20HoldingsService);

  holdings = signal<Kcc20Holding[]>([]);
  loading = signal(true);

  get config(): IFlowPageConfig {
    return {
      id: 'send-kcc20-list',
      title: 'Select KCC20 Token',
      canNavigateBack: true,
    };
  }

  constructor() {
    super();
    effect(() => {
      const wallet = this.walletService.getCurrentWalletSignal()();
      this.reload(wallet);
    });
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
    if (!wallet) {
      this.holdings.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const holdings = await this.kcc20HoldingsService.listHoldings([
        wallet.getAddress(),
        this.currentWalletPubkeyHash(wallet),
      ]);
      this.holdings.set(holdings);
    } catch (error) {
      console.error('Failed to load KCC20 holdings:', error);
      this.holdings.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  trackByHolding(index: number, holding: Kcc20Holding): string {
    return holding.covenantId;
  }

  onHoldingClick(holding: Kcc20Holding): void {
    this.navigateToNextPage({
      id: 'send-kcc20',
      title: `Send ${holding.name}`,
      canNavigateBack: true,
      data: { holding },
    });
  }
}
