import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MonitorService {
  private readonly trackingEnabled = this.isTrackingEnabled();
  // Substring match for unambiguous sensitive fragments.
  private readonly disallowedPropertyPattern =
    /address|wallet|email|device|session|token|secret|private|mnemonic|seed|signature|auth|password|tx|transaction|hash/i;
  // Short, ambiguous fragments matched only as whole tokens, so safe keys
  // like `tip_amount` / `zip_code` / `ship_method` are not dropped.
  private readonly disallowedTokens = new Set(['ip']);

  constructor(private router: Router) {
    if (this.trackingEnabled) {
      this.trackInitialPageView();
      this.router.events
        .pipe(
          filter(
            (event): event is NavigationEnd => event instanceof NavigationEnd,
          ),
        )
        .subscribe((event) => this.trackPageView(event.urlAfterRedirects));
    }
  }

  /**
   * `window.analytics` is attached by KaspaConsentManager only after the user
   * grants consent (the consent script loads asynchronously), so tracking the
   * initial page view immediately would drop it. Wait until analytics is
   * available, then emit the current page view once. Capped so it stops if
   * consent is never granted.
   */
  private trackInitialPageView(attemptsLeft = 60): void {
    if (typeof window === 'undefined') return;
    if (this.isAnalyticsReady()) {
      this.trackPageView(window.location.pathname);
      return;
    }
    if (attemptsLeft <= 0) return;
    setTimeout(() => this.trackInitialPageView(attemptsLeft - 1), 1000);
  }

  /**
   * The Segment instance is loaded once by KaspaConsentManager (see
   * ConsentService) only after the user grants consent, exposed as
   * `window.analytics`. Reading it here keeps tracking behind that single
   * post-consent path instead of loading a second Segment instance.
   */
  private get analytics(): any {
    return typeof window !== 'undefined'
      ? (window as any).analytics
      : undefined;
  }

  /**
   * `window.analytics` may briefly be a stub/queue without a callable `track`
   * before Segment finishes attaching, so check the method exists before
   * emitting (and before stopping the initial-page-view retry loop).
   */
  private isAnalyticsReady(): boolean {
    return typeof this.analytics?.track === 'function';
  }

  trackPageView(route: string) {
    this.track('Page Viewed', {
      route: this.sanitizeRoute(route),
      page_category: this.getPageCategory(route),
    });
  }

  track(event: string, properties?: Record<string, unknown>) {
    if (!this.trackingEnabled || !this.isAnalyticsReady()) return;

    try {
      this.analytics.track(event, {
        ...this.getCommonProperties(),
        ...(this.normalizeProperties(properties || {}) as Record<
          string,
          unknown
        >),
      });
    } catch (error) {
      console.error('Error tracking event:', event, error);
    }
  }

  private normalizeProperties(value: unknown): unknown {
    if (typeof value === 'bigint') {
      // Crypto amounts/fees can exceed Number.MAX_SAFE_INTEGER; keep a number
      // only when it round-trips safely, otherwise serialize as a string.
      return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
        value >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(value)
        : value.toString();
    }
    if (value instanceof Error) {
      return {
        error_name: value.name || 'Error',
        error_category: 'unknown',
      };
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeProperties(item));
    }
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<
        Record<string, unknown>
      >((safe, [key, entry]) => {
        if (this.isDisallowedKey(key)) return safe;
        safe[key] = this.normalizeProperties(entry);
        return safe;
      }, {});
    }
    return value;
  }

  private isDisallowedKey(key: string): boolean {
    if (this.disallowedPropertyPattern.test(key)) return true;
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .split(/[^a-zA-Z0-9]+/)
      .some((token) => this.disallowedTokens.has(token.toLowerCase()));
  }

  private getCommonProperties(): Record<string, unknown> {
    return {
      app: 'wallet',
      environment: environment.isProduction ? 'production' : 'development',
      route: this.sanitizeRoute(window.location.pathname),
      page_category: this.getPageCategory(window.location.pathname),
      referrer_domain: this.getReferrerDomain(),
      is_mobile: window.matchMedia('(max-width: 767px)').matches,
      ...this.getUtmProperties(),
    };
  }

  private isTrackingEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    if (!environment.segmentKey) return false;
    if (!environment.isProduction) return false;
    return environment.allowedDomains.includes(window.location.hostname);
  }

  private sanitizeRoute(route: string): string {
    const path = (route || '/').split('?')[0].split('#')[0] || '/';
    // Mask likely-sensitive path params (addresses, tx ids, long hex/opaque
    // ids) so they don't leak via the `route` attached to every event, while
    // keeping static segments and short public ones (e.g. tickers).
    const masked = path
      .split('/')
      .map((segment) => (this.isSensitiveSegment(segment) ? ':id' : segment))
      .join('/');
    return masked || '/';
  }

  private isSensitiveSegment(segment: string): boolean {
    if (!segment) return false;
    if (segment.includes(':')) return true; // kaspa:... addresses
    if (/^0x[0-9a-fA-F]{6,}$/.test(segment)) return true; // evm address / hash
    if (/^[0-9a-fA-F]{16,}$/.test(segment)) return true; // long hex tx ids
    return segment.length >= 24; // long opaque ids / addresses
  }

  private getPageCategory(route: string): string {
    const cleanRoute = this.sanitizeRoute(route);
    if (cleanRoute.includes('/onboarding')) return 'wallet_onboarding';
    if (cleanRoute.includes('/activity')) return 'wallet_activity';
    if (cleanRoute.includes('/asset/')) return 'wallet_asset';
    if (cleanRoute.includes('/transaction/')) return 'wallet_transaction';
    if (cleanRoute.includes('/app/home')) return 'wallet_home';
    return cleanRoute === '/' ? 'wallet_root' : 'wallet_other';
  }

  private getReferrerDomain(): string | undefined {
    if (!document.referrer) return undefined;
    try {
      return new URL(document.referrer).hostname;
    } catch {
      return undefined;
    }
  }

  private getUtmProperties(): Record<string, string> {
    const params = new URLSearchParams(window.location.search);
    return [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ].reduce<Record<string, string>>((acc, key) => {
      const value = params.get(key);
      if (value) acc[key] = value;
      return acc;
    }, {});
  }
}
