import { inject, Injectable, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'kw-desktop-expanded';
export const MOBILE_BREAKPOINT = 960;
/** Minimum viewport width for the Contracts wide-workspace layout. */
export const WIDE_BREAKPOINT = 1100;

@Injectable({ providedIn: 'root' })
export class DesktopViewService {
  /** True when the wallet is embedded inside an iframe. */
  readonly isIframe: boolean;

  /** User-selected expanded-view preference (persisted in localStorage). */
  readonly isExpandedView: WritableSignal<boolean>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (this.isBrowser) {
      this.isIframe = (() => {
        try {
          return window.self !== window.top;
        } catch {
          // Cross-origin iframe – treat as embedded.
          return true;
        }
      })();
    } else {
      this.isIframe = false;
    }

    const stored = this.isBrowser ? this.readStorage() : null;
    const isDesktop = this.isBrowser && !this.isIframe && window.innerWidth >= MOBILE_BREAKPOINT;
    this.isExpandedView = signal(
      stored !== null ? stored === 'true' : isDesktop,
    );
  }

  toggle(): void {
    if (this.isIframe) return;
    const next = !this.isExpandedView();
    this.isExpandedView.set(next);
    if (this.isBrowser) {
      this.writeStorage(String(next));
    }
  }

  private readStorage(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeStorage(value: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable (privacy mode, quota exceeded, blocked iframe) — skip persistence.
    }
  }
}
