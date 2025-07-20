import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TokenLogoComponent } from '../../common/token-logo/token-logo.component';
import { IToken } from '../../common/interfaces/token.interface';
import { firstValueFrom } from 'rxjs';
import {KasplexKrc20Service} from "../../../../../services/kasplex-api/kasplex-api.service";
import {WalletService} from "../../../../../services/wallet.service";
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-wallet-summary',
  imports: [TokenLogoComponent, DecimalPipe, UpperCasePipe, TitleCasePipe, SkeletonComponent],
  templateUrl: './wallet-summary.component.html',
  styleUrl: './wallet-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class WalletSummaryComponent implements OnInit {
  private walletService = inject(WalletService);
  private kasplexService = inject(KasplexKrc20Service);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);
  private router = inject(Router);

  tokens = signal<IToken[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadKrc20Tokens();
  }

  private async loadKrc20Tokens() {
    try {
      this.loading.set(true);
      const currentWallet = this.walletService.getCurrentWallet();

      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      const response = await firstValueFrom(
        this.kasplexService.getWalletTokenList(currentWallet.getAddress())
      );

      if (response.message === 'successful' && response.result) {
        const krc20Tokens: IToken[] = response.result.map(token => ({
          name: token.tick,
          symbol: token.tick.toUpperCase(),
          address: token.tick,
          balance: this.kaspaNetworkActionsService.sompiToNumber(BigInt(token.balance)), // Convert from sompi
          usdPrice: 0.0
        }));

        this.tokens.set(krc20Tokens);
      }
    } catch (error) {
      console.error('Failed to load KRC20 tokens:', error);
    } finally {
      this.loading.set(false);
    }
  }

  onTokenClick(token: IToken): void {
    // Navigate to the KRC20 asset detail page
    this.router.navigate(['/app/home/asset/krc20', token.address]);
  }
}
