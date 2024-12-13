import { Component, effect, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { NgFor, NgIf } from '@angular/common';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../services/wallet-action.service';
import { KasplexKrc20Service } from '../../services/kasplex-api/kasplex-api.service';
import { ListingInfoEntry } from '../../services/kasplex-api/dtos/listing-info-response.dto';
import { firstValueFrom } from 'rxjs';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';

@Component({
  selector: 'buy-krc20-token',
  standalone: true,
  templateUrl: './buy-krc20.component.html',
  styleUrls: ['./buy-krc20.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor, SompiToNumberPipe],
})
export class BuyKrc20Component {
  protected listings: ListingInfoEntry[] | undefined = undefined;
  protected selectedTicker = signal<string>('');
  protected onlyWalletListing = signal<boolean>(false);




  constructor(
    private walletService: WalletService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService,
    private kasplexService: KasplexKrc20Service
  ) {
    effect(() => {
      this.onlyWalletListing;

      if (this.selectedTicker().length >= 4 && this.selectedTicker().length <= 6) {
        this.loadData();
      }
    })
  }

  async loadData() {
    this.listings = undefined;
    const kasplexResult = await firstValueFrom(this.kasplexService.getListingInfo(this.selectedTicker(), this.onlyWalletListing() ? this.walletService.getCurrentWallet()?.getAddress() : undefined));

    this.listings = kasplexResult.result;
  }

  async buy() {
    const action = this.walletActionService.createBuyKrc20Action((window as any).pskt as string);

    console.log(await this.walletActionService.validateAndDoActionAfterApproval(action));
  }

  async cancel(data: ListingInfoEntry) {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createCancelListingKrc20Action(
        data.tick,
        data.uTxid,
        BigInt(data.amount)
      )
    );
  }

  currentWallet() {
    return this.walletService.getCurrentWallet();
  }
}
