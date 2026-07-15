import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LendingDataService, LendingToken } from '../../services/lending-data.service';

@Component({
  selector: 'app-lending-supply',
  imports: [CommonModule, FormsModule],
  templateUrl: './lending-supply.component.html',
  styleUrl: './lending-supply.component.scss',
})
export class LendingSupplyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected dataService = inject(LendingDataService);

  readonly token = signal<LendingToken | null>(null);
  readonly amount = signal('');
  readonly isProcessing = signal(false);
  readonly txStatus = signal<'idle' | 'success' | 'error'>('idle');
  readonly txError = signal('');

  readonly maxAmount = computed(() => this.token()?.walletBalance ?? '0');
  readonly parsedAmount = computed(() => parseFloat(this.amount()) || 0);
  readonly isValid = computed(
    () => this.parsedAmount() > 0 && this.parsedAmount() <= parseFloat(this.maxAmount()),
  );
  readonly usdValue = computed(() =>
    this.dataService.formatUsd(this.parsedAmount() * (this.token()?.usdPrice ?? 0)),
  );

  ngOnInit() {
    const address = this.route.snapshot.paramMap.get('address');
    if (address && this.dataService.tokens().length) {
      const token = this.dataService.tokens().find(
        (t) => t.address.toLowerCase() === address.toLowerCase(),
      );
      this.token.set(token ?? null);
    } else if (address) {
      // Load data if not yet loaded
      this.dataService.loadData().then(() => {
        const token = this.dataService.tokens().find(
          (t) => t.address.toLowerCase() === address.toLowerCase(),
        );
        this.token.set(token ?? null);
      });
    }
  }

  setMax() {
    this.amount.set(this.maxAmount());
  }

  onAmountChange(value: string) {
    this.amount.set(value);
  }

  async onSubmit() {
    const token = this.token();
    if (!token || !this.isValid()) return;

    this.isProcessing.set(true);
    this.txStatus.set('idle');

    const success = await this.dataService.approveAndSupply(token, this.amount());

    if (success) {
      this.txStatus.set('success');
      await this.dataService.loadData();
    } else {
      this.txStatus.set('error');
      this.txError.set('Transaction failed or was rejected.');
    }
    this.isProcessing.set(false);
  }

  goBack() {
    this.router.navigate(['/app/lending']);
  }
}
