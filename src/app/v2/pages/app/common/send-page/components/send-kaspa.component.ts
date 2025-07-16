import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-send-kaspa',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule],
  templateUrl: './send-kaspa.component.html',
  styleUrl: './send-kaspa.component.scss'
})
export class SendKaspaComponent extends FlowPageBaseComponent {
  walletAddress = '';
  kaspaAmount = 0;
  replaceByFee = false;
  
  get config(): IFlowPageConfig {
    return {
      id: 'send-kaspa',
      title: 'Send Kaspa',
      canNavigateBack: true
    };
  }
  
  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
  }
  
  onAmountChange(value: number): void {
    this.kaspaAmount = value;
  }
  
  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }
  
  onSendClick(): void {
    // Handle send transaction logic here
    console.log('Send Kaspa:', {
      walletAddress: this.walletAddress,
      kaspaAmount: this.kaspaAmount,
      replaceByFee: this.replaceByFee
    });
  }
}