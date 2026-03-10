import { Injectable, signal, WritableSignal } from '@angular/core';
import { IFrameCommunicationApp } from '../../services/communication-service/communication-app/iframe-communication.service';

@Injectable({
  providedIn: 'root',
})
export class IframeAccountSelectionService {
  private static readonly FORCE_ACCOUNT_SELECTION_KEY = 'KC_FORCE_ACCOUNT_SELECTION';
  private isOverlayOpenSignal: WritableSignal<boolean> = signal(false);

  /**
   * Opens the iframe account selection overlay
   */
  openOverlay(): void {
    this.isOverlayOpenSignal.set(true);
  }

  /**
   * Closes the iframe account selection overlay
   */
  closeOverlay(): void {
    this.isOverlayOpenSignal.set(false);
  }

  /**
   * Returns a signal indicating whether the overlay is open
   */
  isOverlayOpen() {
    return this.isOverlayOpenSignal.asReadonly();
  }

  /**
   * Gets the current overlay state value
   */
  isOverlayOpenValue(): boolean {
    return this.isOverlayOpenSignal();
  }

  /**
   * Determines if account selection enforcement is required.
   * Enabled automatically when running within an iframe, or when the debug flag is set.
   */
  shouldEnforceAccountSelection(): boolean {
    return IFrameCommunicationApp.isIframe() || this.isForceAccountSelectionEnabled();
  }

  /**
   * Enable force account selection mode (useful for development outside of iframe context)
   */
  enableForceAccountSelection(): void {
    localStorage.setItem(IframeAccountSelectionService.FORCE_ACCOUNT_SELECTION_KEY, 'true');
  }

  /**
   * Disable force account selection mode
   */
  disableForceAccountSelection(): void {
    localStorage.removeItem(IframeAccountSelectionService.FORCE_ACCOUNT_SELECTION_KEY);
  }

  /**
   * Checks whether the force flag is currently enabled.
   */
  private isForceAccountSelectionEnabled(): boolean {
    return localStorage.getItem(IframeAccountSelectionService.FORCE_ACCOUNT_SELECTION_KEY) === 'true';
  }
}

