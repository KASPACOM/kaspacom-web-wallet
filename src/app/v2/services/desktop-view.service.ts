import { Injectable, signal, WritableSignal } from '@angular/core';

const STORAGE_KEY = 'kw-desktop-expanded';
const MOBILE_BREAKPOINT = 960;

@Injectable({ providedIn: 'root' })
export class DesktopViewService {
  /** True when the wallet is embedded inside an iframe. */
  readonly isIframe: boolean;

  /** User-selected expanded-view preference (persisted in localStorage). */
  readonly isExpandedView: WritableSignal<boolean>;

  constructor() {
    this.isIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        // Cross-origin iframe – treat as embedded.
        return true;
      }
    })();

    const stored = localStorage.getItem(STORAGE_KEY);
    const isDesktop = !this.isIframe && window.innerWidth >= MOBILE_BREAKPOINT;
    this.isExpandedView = signal(
      stored !== null ? stored === 'true' : isDesktop,
    );
  }

  toggle(): void {
    if (this.isIframe) return;
    const next = !this.isExpandedView();
    this.isExpandedView.set(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }
}
