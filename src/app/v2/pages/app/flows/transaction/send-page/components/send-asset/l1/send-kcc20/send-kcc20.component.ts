import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { KcNumberInputComponent, KcInputComponent, KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { FlowPageBaseComponent } from '../../../../../../../common/flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../../../../../../common/flow-page/interfaces/flow-page.interface';
import { UtilsHelper } from '../../../../../../../../../../services/utils.service';
import {
  Kcc20TransferService,
} from '../../../../../../../../../../services/kcc20-api/kcc20-transfer.service';
import { Kcc20Holding } from '../../../../../../../../../../services/covenant/kcc20-holdings.service';
import { Kcc20TokenLogoComponent } from '../../../../../../../home/assets-lists/l1/logo/kcc20-token-logo/kcc20-token-logo.component';

const OWNER_HEX_REGEX = /^[a-fA-F0-9]{64}$/;

@Component({
  selector: 'app-send-kcc20',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    KcNumberInputComponent,
    KcInputComponent,
    KcButtonComponent,
    Kcc20TokenLogoComponent,
  ],
  templateUrl: './send-kcc20.component.html',
  styleUrl: './send-kcc20.component.scss',
})
export class SendKcc20Component extends FlowPageBaseComponent {
  private router = inject(Router);
  private utilsHelper = inject(UtilsHelper);
  private notificationService = inject(NotificationService);
  private kcc20TransferService = inject(Kcc20TransferService);

  holding = signal<Kcc20Holding | undefined>(undefined);

  recipient = '';
  tokenAmount = '';
  isLoading = false;

  isRecipientValid = true;
  isAmountValid = true;
  recipientErrorMessage = '';
  amountErrorMessage = '';

  get config(): IFlowPageConfig {
    return {
      id: 'send-kcc20',
      title: `Send ${this.holding()?.ticker ?? 'Token'}`,
      canNavigateBack: true,
    };
  }

  override ngOnInit() {
    super.ngOnInit();
    const holding = this.flowPagesService.activePage()?.data?.[
      'holding'
    ] as Kcc20Holding | undefined;
    if (!holding) {
      this.notificationService.error('Error', 'No token selected');
      this.navigateBack();
      return;
    }
    this.holding.set(holding);
    this.tokenAmount = '';
  }

  get availableBalance(): number {
    return this.holding()?.balance || 0;
  }

  get isFormValid(): boolean {
    return (
      this.isRecipientValid &&
      this.isAmountValid &&
      !!this.recipient.trim() &&
      !!this.tokenAmount &&
      Number(this.tokenAmount) > 0 &&
      !this.isLoading
    );
  }

  onRecipientChange(value: any): void {
    this.recipient = value?.toString() || '';
    this.validateRecipient();
  }

  onAmountChange(amount: any): void {
    this.tokenAmount = amount?.toString() || '';
    this.validateAmount();
  }

  onMaxAmountClick(): void {
    this.tokenAmount =
      this.availableBalance > 0 ? this.availableBalance.toString() : '';
    this.validateAmount();
  }

  private validateRecipient(): void {
    const value = this.recipient.trim();
    if (!value) {
      this.isRecipientValid = false;
      this.recipientErrorMessage = 'Enter a recipient address or owner hex.';
      return;
    }
    if (this.utilsHelper.isValidWalletAddress(value) || OWNER_HEX_REGEX.test(value)) {
      this.isRecipientValid = true;
      this.recipientErrorMessage = '';
      return;
    }
    this.isRecipientValid = false;
    this.recipientErrorMessage = 'Enter a valid Kaspa address or 64-character owner hex.';
  }

  private validateAmount(): void {
    const amount = Number(this.tokenAmount);
    if (!this.tokenAmount || !Number.isFinite(amount) || amount <= 0) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Amount must be greater than 0';
      return;
    }
    if (amount > this.availableBalance) {
      this.isAmountValid = false;
      this.amountErrorMessage = 'Insufficient balance';
      return;
    }
    this.isAmountValid = true;
    this.amountErrorMessage = '';
  }

  async onSendClick(): Promise<void> {
    const holding = this.holding();
    if (!this.isFormValid || !holding) {
      return;
    }

    this.isLoading = true;
    try {
      const result = await this.kcc20TransferService.transfer(
        holding.covenantId,
        this.tokenAmount.trim(),
        this.recipient.trim(),
      );

      if (result.success) {
        this.notificationService.success('Success', 'KCC20 token sent successfully!');
        this.navigateBack();
      } else {
        this.notificationService.error('Error', 'Transfer was rejected or failed.');
      }
    } catch (error) {
      console.error('Error sending KCC20 token:', error);
      this.notificationService.error(
        'Error',
        error instanceof Error ? error.message : 'Failed to send KCC20 token',
      );
    } finally {
      this.isLoading = false;
    }
  }

  protected override navigateBack(): void {
    this.flowPagesService.closePage();
    this.router.navigate(['/app/home'], { queryParams: { tab: 'kcc20' } });
  }
}
