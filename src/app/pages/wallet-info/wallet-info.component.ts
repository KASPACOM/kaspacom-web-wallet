import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';
import { firstValueFrom, map, tap } from 'rxjs';
import { KasplexKrc20Service } from '../../services/kasplex-api/kasplex-api.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';
import { SendAssetComponent } from '../../components/send-asset/send-asset.component';
import { ReviewActionComponent } from '../../components/review-action/review-action.component';
import { WalletActionService } from '../../services/wallet-action.service';

@Component({
  selector: 'wallet-info',
  standalone: true,
  templateUrl: './wallet-info.component.html',
  styleUrls: ['./wallet-info.component.scss'],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NgIf,
    NgFor,
    SompiToNumberPipe,
    SendAssetComponent,
    ReviewActionComponent,
  ],
})
export class WalletInfoComponent implements OnInit, AfterViewInit {
  @ViewChild('reviewActionComponent')
  reviewActionComponent!: ReviewActionComponent;

  protected wallet: AppWallet | undefined = undefined;
  protected tokens: undefined | { ticker: string; balance: number }[] =
    undefined;

  private paginationPrevTokenKey?: string | null;
  private paginationNextTokenKey?: string | null;
  private paginationDirection?: 'next' | 'prev' | null;

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router,
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService
  ) {}

  async ngOnInit(): Promise<void> {
    this.wallet = this.walletService.getCurrentWallet();

    if (!this.wallet) {
      this.router.navigate(['/wallet-selection']);
    }

    this.loadKrc20Tokens();
  }

  ngAfterViewInit(): void {
    this.walletActionService.registerViewingComponent(
      this.reviewActionComponent
    );
  }

  async loadKrc20Tokens() {
    const paginationKey =
      this.paginationDirection === 'next'
        ? this.paginationNextTokenKey
        : this.paginationPrevTokenKey;

    const tokens: { ticker: string; balance: number }[] = await firstValueFrom(
      this.kasplexService
        .getWalletTokenList(
          this.wallet!.getAddress(),
          paginationKey,
          this.paginationDirection
        )
        .pipe(
          tap((response) => {
            this.paginationPrevTokenKey = response.prev;
            this.paginationNextTokenKey = response.next;
          }),
          map((response) => {
            return response.result.map((token) => ({
              ticker: token.tick,
              balance: this.kaspaNetworkActionsService.sompiToNumber(
                BigInt(+token.balance)
              ),
            }));
          })
        )
    );

    this.tokens = tokens;
  }
}
