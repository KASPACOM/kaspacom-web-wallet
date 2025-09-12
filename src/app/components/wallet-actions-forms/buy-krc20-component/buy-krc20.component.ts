import { Component, effect, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';
import { NgFor, NgIf } from '@angular/common';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { KasplexKrc20Service } from '../../../services/kasplex-api/kasplex-api.service';
import { ListingInfoEntry } from '../../../services/kasplex-api/dtos/listing-info-response.dto';
import { firstValueFrom } from 'rxjs';
import { SompiToNumberPipe } from '../../../pipes/sompi-to-number.pipe';
import { Krc20WalletActionService } from '../../../services/protocols/krc20/krc20-wallet-actions.service';

@Component({
    selector: 'buy-krc20-token',
    templateUrl: './buy-krc20.component.html',
    styleUrls: ['./buy-krc20.component.scss'],
    imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor, SompiToNumberPipe]
})
export class BuyKrc20Component {
  protected listings: ListingInfoEntry[] | undefined = undefined;
  protected selectedTicker = signal<string>('');
  protected onlyWalletListing = signal<boolean>(false);




  constructor(
    private walletService: WalletService,
    private walletActionService: WalletActionService,
    private krc20WalletActionService: Krc20WalletActionService,
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
    const action = this.walletActionService.createSignPsktAction((window as any).pskt as string, true);

    console.log(await this.walletActionService.validateAndDoActionAfterApproval(action));
  }

  async cancel(data: ListingInfoEntry) {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.krc20WalletActionService.createCancelListingKrc20Action(
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
