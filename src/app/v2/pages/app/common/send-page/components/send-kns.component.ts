import { Component, OnInit, signal, inject, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FlowPageBaseComponent } from '../../flow-page/base/flow-page-base.component';
import { IFlowPageConfig } from '../../flow-page/interfaces/flow-page.interface';
import { KcInputComponent, KcCheckboxComponent, KcButtonComponent } from 'kaspacom-ui';
import { FormsModule } from '@angular/forms';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton/skeleton.component';
import { KnsDomainAsset } from '../../../../../../services/kns-api/dtos/kns-domain.dto';
import { KnsApiService } from '../../../../../../services/kns-api/kns-api.service';
import { WalletService } from '../../../../../../services/wallet.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-send-kns',
  standalone: true,
  imports: [CommonModule, KcInputComponent, KcCheckboxComponent, KcButtonComponent, FormsModule, DatePipe, SkeletonComponent],
  templateUrl: './send-kns.component.html',
  styleUrl: './send-kns.component.scss'
})
export class SendKnsComponent extends FlowPageBaseComponent implements OnInit {
  private walletService = inject(WalletService);
  private knsService = inject(KnsApiService);
  
  domain = signal<KnsDomainAsset | undefined>(undefined);
  loading = signal<boolean>(true);
  walletAddress = '';
  replaceByFee = false;
  
  constructor() {
    super();
    
    // React to page configuration changes
    effect(() => {
      const currentPage = this.flowPagesService.activePage();
      if (currentPage?.id === 'send-kns') {
        this.loadDomainData();
      }
    });
  }
  
  override async ngOnInit(): Promise<void> {
    // Initial load will be handled by the effect
  }
  
  get config(): IFlowPageConfig {
    const currentDomain = this.domain();
    return {
      id: 'send-kns',
      title: `Send ${currentDomain?.asset || 'KNS'}`,
      canNavigateBack: true
    };
  }
  
  get isFormValid(): boolean {
    return this.walletAddress.trim().length > 0;
  }
  
  onWalletAddressChange(value: string): void {
    this.walletAddress = value;
  }
  
  onRbfChange(value: boolean): void {
    this.replaceByFee = value;
  }
  
  onSendClick(): void {
    const currentDomain = this.domain();
    if (!this.isFormValid || !currentDomain) {
      return;
    }
    
    // Handle send KNS transaction logic here
    console.log('Send KNS:', {
      domain: currentDomain,
      walletAddress: this.walletAddress,
      replaceByFee: this.replaceByFee
    });
  }

  private async loadDomainData(): Promise<void> {
    try {
      this.loading.set(true);
      
      // Clear form data when loading new domain
      this.walletAddress = '';
      this.replaceByFee = false;
      
      // Get navigation data
      const navigationData = this.getNavigationData();
      
      if (!navigationData || !navigationData.assetId) {
        console.warn('No domain assetId provided in navigation data');
        return;
      }

      // Load domain data using the assetId
      const response = await firstValueFrom(
        this.knsService.fetchAssetByAssetId(navigationData.assetId)
      );

      if (response.data) {
        this.domain.set(response.data);
      }
    } catch (error) {
      console.error('Failed to load KNS domain data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private getNavigationData(): any {
    // Get data from current page configuration
    const currentPage = this.getCurrentConfig();
    return currentPage?.data || {};
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  getDomainType(): string {
    const currentDomain = this.domain();
    return currentDomain?.isDomain ? 'DOM' : 'TXT';
  }

  getDomainTypeLabel(): string {
    const currentDomain = this.domain();
    return currentDomain?.isDomain ? 'Domain' : 'Text Record';
  }

  getDisplayName(): string {
    const currentDomain = this.domain();
    return currentDomain?.asset || 'KNS Domain';
  }

  getStatus(): string {
    const currentDomain = this.domain();
    return currentDomain?.status || 'Unknown';
  }

  isVerified(): boolean {
    const currentDomain = this.domain();
    return currentDomain?.isVerifiedDomain || false;
  }
}