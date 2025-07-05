import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { TokenLogoComponent } from '../../common/token-logo/token-logo.component';
import { IToken } from '../../common/interfaces/token.interface';
import { WalletService } from '../../../../services/wallet.service';
import { KasplexKrc20Service } from '../../../../services/kasplex-api/kasplex-api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-wallet-summary',
  imports: [TokenLogoComponent, DecimalPipe, UpperCasePipe, TitleCasePipe],
  templateUrl: './wallet-summary.component.html',
  styleUrl: './wallet-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class WalletSummaryComponent implements OnInit {
  private walletService = inject(WalletService);
  private kasplexService = inject(KasplexKrc20Service);
  
  tokens = signal<IToken[]>([]);
  loading = signal<boolean>(false);

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
          balance: parseFloat(token.balance),
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
}
