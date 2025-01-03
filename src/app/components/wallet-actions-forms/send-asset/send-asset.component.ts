import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { WalletService } from '../../../services/wallet.service';
import { NgFor, NgIf } from '@angular/common';
import { TransferableAsset } from '../../../types/transferable-asset';
import { WalletAction, WalletActionType } from '../../../types/wallet-action';
import { KaspaNetworkActionsService } from '../../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { WalletActionService } from '../../../services/wallet-action.service';
import { ERROR_CODES } from '../../../config/consts';

@Component({
  selector: 'send-asset',
  standalone: true,
  templateUrl: './send-asset.component.html',
  styleUrls: ['./send-asset.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, NgIf, NgFor],
})
export class SendAssetComponent implements OnInit {
  assets: undefined | TransferableAsset[] = undefined; // Replace with your dynamic asset list
  selectedAsset: undefined | string = undefined;
  amount: number | null = null;
  recipientAddress: string = '';

  constructor(
    private walletService: WalletService,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService
  ) {}

  async ngOnInit(): Promise<void> {
    this.assets =
      await this.walletService.getAllAvailableAssetsForCurrentWallet();

    this.selectedAsset =
      this.selectedAsset || this.getAssetId(this.assets?.[0]);
  }

  // Validate the form
  isFormValid(): boolean {
    return (this.selectedAsset && this.amount && this.amount > 0) || false;
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
        this.walletActionService.createTransferWalletActionFromAsset(
          selectedAsset!,
          this.recipientAddress,
          this.kaspaNetworkActionsService.kaspaToSompiFromNumber(this.amount!),
          this.walletService.getCurrentWallet()!
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
