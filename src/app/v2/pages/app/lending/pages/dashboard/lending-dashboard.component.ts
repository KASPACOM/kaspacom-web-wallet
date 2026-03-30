import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LendingDataService, LendingToken } from '../../services/lending-data.service';

@Component({
  selector: 'app-lending-dashboard',
  imports: [CommonModule],
  templateUrl: './lending-dashboard.component.html',
  styleUrl: './lending-dashboard.component.scss',
})
export class LendingDashboardComponent implements OnInit {
  protected dataService = inject(LendingDataService);
  private router = inject(Router);

  readonly isLoading = this.dataService.isLoading;
  readonly error = this.dataService.error;
  readonly userMetrics = this.dataService.userMetrics;
  readonly suppliedTokens = this.dataService.suppliedTokens;
  readonly borrowedTokens = this.dataService.borrowedTokens;
  readonly availableToSupply = this.dataService.availableToSupply;
  readonly availableToBorrow = this.dataService.availableToBorrow;

  // Active section: 'supply' | 'borrow'
  readonly activeSection = signal<'supply' | 'borrow'>('supply');

  readonly healthFactorClass = computed(() => {
    const hf = this.userMetrics().healthFactor;
    if (!isFinite(hf) || hf > 2) return 'safe';
    if (hf > 1.2) return 'warning';
    return 'danger';
  });

  ngOnInit() {
    this.dataService.loadData();
  }

  onSupplyClick(token: LendingToken) {
    this.router.navigate(['/app/lending/supply', token.address]);
  }

  onWithdrawClick(token: LendingToken) {
    this.router.navigate(['/app/lending/withdraw', token.address]);
  }

  onBorrowClick(token: LendingToken) {
    this.router.navigate(['/app/lending/borrow', token.address]);
  }

  onRepayClick(token: LendingToken) {
    this.router.navigate(['/app/lending/repay', token.address]);
  }

  refresh() {
    this.dataService.loadData();
  }

  formatApy(apy: number): string {
    return apy.toFixed(2) + '%';
  }

  formatBalance(balance: string, decimals = 4): string {
    const val = parseFloat(balance);
    if (val === 0) return '0';
    return val.toFixed(decimals);
  }

  formatUsd(amount: number): string {
    return this.dataService.formatUsd(amount);
  }

  formatHf(): string {
    return this.dataService.formatHealthFactor(this.userMetrics().healthFactor);
  }

  setSection(s: 'supply' | 'borrow') {
    this.activeSection.set(s);
  }

  parseFloat(v: string): number {
    return parseFloat(v) || 0;
  }
}
