import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';
import { NgFor, NgIf } from '@angular/common';
import { TransferableAsset } from '../../../types/transferable-asset';
import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { ERROR_CODES } from 'kaspacom-wallet-messages';
import { Krc20WalletActionService } from '../../../services/protocols/krc20/krc20-wallet-actions.service';

@Component({
  selector: 'list-krc20-token',
  standalone: true,
  templateUrl: './list-krc20-component.component.html',
  styleUrls: ['./list-krc20-component.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor],
})
export class ListKrc20Component implements OnInit {
  assets: undefined | TransferableAsset[] = undefined; // Replace with your dynamic asset list
  selectedAsset: undefined | string = undefined;
  amount: number | null = null;
  totalPrice: number | null = null;

  constructor(
    private walletService: WalletService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService,
    private krc20WalletActionService: Krc20WalletActionService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.assets =
      await this.walletService.getKrc20AvailableAssetsForCurrentWallet();

    this.selectedAsset =
      this.selectedAsset || this.getAssetId(this.assets?.[0]);
  }

  // Validate the form
  isFormValid(): boolean {
    return (this.selectedAsset && this.amount && this.amount > 0 && this.totalPrice && this.totalPrice > 0) || false;
  }

  // Handle the send action
  async sendAsset(): Promise<void> {
    if (!this.walletService.getCurrentWallet()) {
      return;
    }

    if (this.isFormValid()) {
      const selectedAsset = this.assets?.find(
        (asset) => this.selectedAsset == this.getAssetId(asset)
      );

      const action: WalletAction =
        this.krc20WalletActionService.createListKrc20Action(
          this.walletService.getCurrentWallet()!.getAddress(),
          selectedAsset!.ticker,
          this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.amount!),
          [{
            address: this.walletService.getCurrentWallet()!.getAddress(),
            amount: this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.totalPrice!),
          }],
        );

      const result =
        await this.walletActionService.validateAndDoActionAfterApproval(action);

      if (result.success) {
        this.amount = null;
      } else {
        if (result.errorCode != ERROR_CODES.WALLET_ACTION.USER_REJECTED) {
          alert(result.errorCode);
          return;
        }
      }

      // Add your transaction logic here
    } else {
      alert('Please fill in all fields correctly.');
    }
  }

  getAssetId(asset: TransferableAsset): string {
    return `${asset.type}-${asset.ticker}`;
  }
}
