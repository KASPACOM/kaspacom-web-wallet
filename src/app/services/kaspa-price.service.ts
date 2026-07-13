import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

interface KaspaPriceResponse {
  price: number;
}

@Injectable({
  providedIn: 'root',
})
export class KaspaPriceService implements OnDestroy {
  private readonly httpClient = inject(HttpClient);

  private readonly KASPA_PRICE_API_URL = 'https://api.kaspa.org/info/price';
  private readonly UPDATE_INTERVAL = 10000; // 10 seconds

  private priceSignal = signal<number>(0);
  private intervalId: NodeJS.Timeout | undefined;
  private isLoadingSignal = signal<boolean>(false);
  private lastUpdatedSignal = signal<Date | null>(null);

  // Public readonly signals
  public readonly price = this.priceSignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly lastUpdated = this.lastUpdatedSignal.asReadonly();

  constructor() {
    this.startPriceUpdates();
  }

  ngOnDestroy(): void {
    this.stopPriceUpdates();
  }

  private startPriceUpdates(): void {
    // Fetch price immediately
    this.fetchPrice();

    // Then start the interval for periodic updates
    this.intervalId = setInterval(() => {
      this.fetchPrice();
    }, this.UPDATE_INTERVAL);
  }

  private stopPriceUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private fetchPrice(): void {
    this.isLoadingSignal.set(true);

    this.httpClient
      .get<KaspaPriceResponse>(this.KASPA_PRICE_API_URL)
      .pipe(
        catchError((error) => {
          console.error('Failed to fetch Kaspa price:', error);
          // Return the current price to avoid disrupting the signal
          return of({ price: this.priceSignal() });
        }),
      )
      .subscribe({
        next: (response) => {
          if (response && typeof response.price === 'number') {
            this.priceSignal.set(response.price);
            this.lastUpdatedSignal.set(new Date());
          }
        },
        complete: () => {
          this.isLoadingSignal.set(false);
        },
      });
  }

  /**
   * Manually trigger a price refresh
   */
  public refreshPrice(): void {
    this.fetchPrice();
  }

  /**
   * Get the current price value synchronously
   */
  public getCurrentPrice(): number {
    return this.priceSignal();
  }
}
