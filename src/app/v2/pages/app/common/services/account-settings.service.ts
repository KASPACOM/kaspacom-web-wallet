import { Injectable, inject } from '@angular/core';
import { FlowPagesService } from './flow-pages.service';

@Injectable({
  providedIn: 'root'
})
export class AccountSettingsService {
  private flowPagesService = inject(FlowPagesService);
  
  get isOpen() {
    return this.flowPagesService.isPageOpen('wallet-management');
  }
  
  open() {
    this.flowPagesService.openFlow({
      id: 'wallet-management',
      title: 'Manage accounts',
      canNavigateBack: false, // Wallet management is controlled by chevron in header
      canClose: true
    });
  }
  
  close() {
    this.flowPagesService.closePage();
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
} 