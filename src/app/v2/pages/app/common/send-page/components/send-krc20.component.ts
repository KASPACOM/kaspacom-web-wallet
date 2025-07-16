import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { IToken } from '../../../common/interfaces/token.interface';
import { TokenLogoComponent } from '../../token-logo/token-logo.component';

@Component({
  selector: 'app-send-krc20',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule, TokenLogoComponent],
  templateUrl: './send-krc20.component.html',
  styleUrl: './send-krc20.component.scss'
})
export class SendKrc20Component extends FlowPageBaseComponent implements OnInit {
  @Input() token?: IToken;
  
  walletAddress = '';
  tokenAmount = 0;
  replaceByFee = false;
  
  override ngOnInit(): void {
    // Get token from navigation data if not provided as input
    // TODO: Implement proper token passing mechanism
    if (!this.token) {
      // For now, use mock data or get from service
      console.warn('No token provided to send-krc20 component');
    }
  }
  
  get config(): IFlowPageConfig {
    return {
      id: 'send-krc20',
      title: `Send ${this.token?.name || 'KRC20'}`,
      canNavigateBack: true
    };
  }
  
  get availableBalance(): number {
    return this.token?.balance || 0;
  }
  
  get isValidAmount(): boolean {
    return this.tokenAmount > 0 && this.tokenAmount <= this.availableBalance;
  }
  
  get isFormValid(): boolean {
    return this.walletAddress.trim().length > 0 && this.isValidAmount;
  }
  
  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
  }
  
  onAmountChange(value: number): void {
    this.tokenAmount = value;
  }
  
  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }
  
  onMaxAmountClick(): void {
    this.tokenAmount = this.availableBalance;
  }
  
  onSendClick(): void {
    if (!this.isFormValid || !this.token) {
      return;
    }
    
    // Handle send KRC20 transaction logic here
    console.log('Send KRC20:', {
      token: this.token,
      walletAddress: this.walletAddress,
      tokenAmount: this.tokenAmount,
      replaceByFee: this.replaceByFee
    });
  }
}