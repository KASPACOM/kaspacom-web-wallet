import { Component, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe, UpperCasePipe, DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { KnsApiService } from '../../../../../services/kns-api/kns-api.service';
import { WalletService } from '../../../../../services/wallet.service';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { KnsDomainAsset } from '../../../../../services/kns-api/dtos/kns-domain.dto';

@Component({
  selector: 'app-kns-summary',
  imports: [TitleCasePipe, UpperCasePipe, DatePipe, SkeletonComponent],
  templateUrl: './kns-summary.component.html',
  styleUrl: './kns-summary.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class KnsSummaryComponent implements OnInit {
  private walletService = inject(WalletService);
  private knsService = inject(KnsApiService);

  domains = signal<KnsDomainAsset[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    await this.loadKnsDomains();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private async loadKnsDomains() {
    try {
      this.loading.set(true);
      const currentWallet = this.walletService.getCurrentWallet();

      if (!currentWallet) {
        console.warn('No current wallet selected');
        return;
      }

      // Use the getAllWalletDomains method which handles pagination
      const domains = await this.knsService.getAllWalletDomains(currentWallet.getAddress());

      console.log('KNS API Response:', domains);

      this.domains.set(domains);
    } catch (error) {
      console.error('Failed to load KNS domains:', error);
    } finally {
      this.loading.set(false);
    }
  }
} 