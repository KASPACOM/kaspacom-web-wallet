import { inject, Injectable, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'kw-desktop-expanded';
export const MOBILE_BREAKPOINT = 960;

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

    const stored = this.isBrowser ? localStorage.getItem(STORAGE_KEY) : null;
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
      localStorage.setItem(STORAGE_KEY, String(next));
    }
  }
}
