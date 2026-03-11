import { Injectable, signal, computed } from '@angular/core';
import type { Erc20Token, SwapSettings } from '@kaspacom/swap-sdk';

export interface SwapContext {
  fromToken: Erc20Token;
  toToken: Erc20Token;
  fromAmount: string;
  toAmount: string;
  minReceived: string;
  route: string;
  settings: SwapSettings;
  networkName: string;
  priceImpact: string;
  estimatedGas: string;
}

@Injectable({
  providedIn: 'root',
})
export class SwapContextService {
  private swapContextSignal = signal<SwapContext | null>(null);
  private currentContextId: string | null = null;

  // Public computed for components to observe
  swapContext = computed(() => this.swapContextSignal());

  /**
   * Store swap context before triggering SDK swap
   * Returns a context ID that must be passed to clearSwapContext
   */
  setSwapContext(context: SwapContext): string {
    const contextId = `swap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.currentContextId = contextId;
    this.swapContextSignal.set(context);
    return contextId;
  }

  /**
   * Get current swap context (for approval flow)
   */
  getSwapContext(): SwapContext | null {
    return this.swapContextSignal();
  }

  /**
   * Check if there's an active swap context
   */
  hasSwapContext(): boolean {
    return this.swapContextSignal() !== null;
  }

  /**
   * Clear swap context after approval/rejection
   * Only clears if the contextId matches the current context
   */
  clearSwapContext(contextId?: string): void {
    // If no contextId provided or it matches current, clear the context
    if (!contextId || contextId === this.currentContextId) {
      this.swapContextSignal.set(null);
      this.currentContextId = null;
    }
  }
}
