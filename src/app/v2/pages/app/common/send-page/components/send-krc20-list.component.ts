import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { TokenLogoComponent } from '../../token-logo/token-logo.component';
import { IToken } from '../../../common/interfaces/token.interface';
import { firstValueFrom } from 'rxjs';
import {KasplexKrc20Service} from "../../../../../../services/kasplex-api/kasplex-api.service";
import {WalletService} from "../../../../../../services/wallet.service";
import {SkeletonComponent} from "../../../../../shared/ui/skeleton";
import {GetTokenListResponse, TokenInfo} from "../../../../../../services/kasplex-api/dtos/token-list-info.dto";

@Component({
  selector: 'app-send-krc20-list',
  standalone: true,
  imports: [CommonModule, TokenLogoComponent, SkeletonComponent, DecimalPipe, TitleCasePipe, UpperCasePipe],
  templateUrl: './send-krc20-list.component.html',
  styleUrl: './send-krc20-list.component.scss'
})
export class SendKrc20ListComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private kasplexService = inject(KasplexKrc20Service);

  tokens = signal<IToken[]>([]);
  loading = signal<boolean>(true);

  get config(): IFlowPageConfig {
    return {
      id: 'send-krc20-list',
      title: 'Select KRC20 Token',
      canNavigateBack: true
    };
  }

  override async ngOnInit() {
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

      const response: GetTokenListResponse = await firstValueFrom(
        this.kasplexService.getWalletTokenList(currentWallet.getAddress())
      );

      if (response.message === 'successful' && response.result) {
        const krc20Tokens: IToken[] = response.result
          .filter((token: TokenInfo) => parseFloat(token.balance) > 0) // Only show tokens with balance
          .map((token: TokenInfo) => ({
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

  onTokenClick(token: IToken): void {
    this.navigateToNextPage({
      id: 'send-krc20',
      title: `Send ${token.name}`,
      canNavigateBack: true
    });
    // Store token data in service or pass it differently
    (this as any).selectedToken = token;
  }
}
