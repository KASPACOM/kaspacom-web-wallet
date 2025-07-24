import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { KcButtonComponent, KcIconComponent } from 'kaspacom-ui';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton.component';
import { CopyButtonComponent } from '../../../../shared/ui/copy-button/copy-button.component';
import { KasplexKrc20Service } from '../../../../../services/kasplex-api/kasplex-api.service';
import { OperationDetails } from '../../../../../services/kasplex-api/dtos/operation-details-response';
import { environment } from '../../../../../../environments/environment';
import { KaspaNetworkActionsService } from '../../../../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-krc20-transaction-details',
  imports: [
    CommonModule,
    DatePipe,
    KcButtonComponent,
    KcIconComponent,
    SkeletonComponent,
    CopyButtonComponent
  ],
  templateUrl: './krc20-transaction-details.component.html',
  styleUrl: './krc20-transaction-details.component.scss'
})
export class Krc20TransactionDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private kasplexService = inject(KasplexKrc20Service);
  private kaspaNetworkActionsService = inject(KaspaNetworkActionsService);

  protected ticker: string | null = null;
  protected transactionId: string | null = null;
  protected operationDetails = signal<OperationDetails | null>(null);
  protected loading = signal<boolean>(true);

  ngOnInit(): void {
    this.ticker = this.route.snapshot.paramMap.get('ticker');
    this.transactionId = this.route.snapshot.paramMap.get('transactionId');
    
    if (this.transactionId) {
      this.loadOperationDetails();
    } else {
      this.loading.set(false);
    }
  }

  private async loadOperationDetails(): Promise<void> {
    if (!this.transactionId) return;

    try {
      this.loading.set(true);
      const response = await firstValueFrom(
        this.kasplexService.getOperationDetails(this.transactionId)
      );

      if (response.message === 'successful' && response.result?.length > 0) {
        this.operationDetails.set(response.result[0]);
      }
    } catch (error) {
      console.error('Failed to load operation details:', error);
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    // Check if we came from activity page
    const navigationState = this.router.getCurrentNavigation()?.extras?.state;
    const historyState = history.state;
    
    const returnTo = navigationState?.['returnTo'] || historyState?.['returnTo'];
    
    if (returnTo === 'activity') {
      this.router.navigate(['/app/activity']);
    } else if (this.ticker) {
      this.router.navigate(['/app/home/asset/krc20', this.ticker]);
    } else {
      this.router.navigate(['/app/home'], { queryParams: { tab: 'krc20' } });
    }
  }

  protected formatAmount(amount: string | undefined): string {
    if (!amount) return '0';
    const amountInSompi = BigInt(amount);
    const numAmount = this.kaspaNetworkActionsService.sompiToNumber(amountInSompi);
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    });
  }

  protected formatDate(timestamp: string): string {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  protected shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 20)}...${address.slice(-8)}`;
  }

  protected getOperationStatus(operation: OperationDetails): string {
    if (operation.txAccept === '1' && operation.opAccept === '1') {
      return 'Confirmed';
    } else if (operation.txAccept === '1' && operation.opAccept !== '1') {
      return 'Implemented';
    } else {
      return 'Pending';
    }
  }

  protected openTransactionInExplorer(): void {
    const operation = this.operationDetails();
    if (operation) {
      const explorerUrl = `${environment.kaspaExplorerBaseurl}/txs/${operation.hashRev}`;
      window.open(explorerUrl, '_blank');
    }
  }
} 