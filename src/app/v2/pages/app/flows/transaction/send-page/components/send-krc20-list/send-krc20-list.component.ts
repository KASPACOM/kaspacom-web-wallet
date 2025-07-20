import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../common/flow-page/interfaces/flow-page.interface';
import { TokenLogoComponent } from '../../../../../common/token-logo/token-logo.component';
import { IToken } from '../../../../../common/interfaces/token.interface';
import { firstValueFrom } from 'rxjs';
import {KasplexKrc20Service} from "../../../../../../../../services/kasplex-api/kasplex-api.service";
import {WalletService} from "../../../../../../../../services/wallet.service";
import {SkeletonComponent} from "../../../../../../../shared/ui/skeleton";
import {GetTokenListResponse, TokenInfo} from "../../../../../../../../services/kasplex-api/dtos/token-list-info.dto";
import { KaspaNetworkActionsService } from '../../../../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

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
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);

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
        // Get token info for each token to include decimals
        const tokenPromises = response.result
          .filter((token: TokenInfo) => parseFloat(token.balance) > 0) // Only show tokens with balance
          .map(async (token: TokenInfo) => {
            try {
              // Get token info to get decimals
              const tokenInfoResponse = await firstValueFrom(
                this.kasplexService.getTokenInfo(token.tick)
              );
              
              const tokenInfo = tokenInfoResponse.result?.[0];
              const decimals = tokenInfo ? parseInt(tokenInfo.dec || '0') : 0;
              
              return {
                name: token.tick,
                symbol: token.tick.toUpperCase(),
                address: token.tick,
                balance: this.kaspaNetworkActionsService.sompiToNumber(BigInt(token.balance)), // Convert from sompi
                usdPrice: 0.0,
                decimals: decimals
              } as IToken;
            } catch (error) {
              console.error(`Failed to get decimals for token ${token.tick}:`, error);
              // Return token without decimals info if API call fails
              return {
                name: token.tick,
                symbol: token.tick.toUpperCase(),
                address: token.tick,
                balance: this.kaspaNetworkActionsService.sompiToNumber(BigInt(token.balance)), // Convert from sompi
                usdPrice: 0.0,
                decimals: 0
              } as IToken;
            }
          });

        const krc20Tokens = await Promise.all(tokenPromises);
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
      canNavigateBack: true,
      data: {
        token: token
      }
    });
  }
}
