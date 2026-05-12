import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AnalyticsBrowser } from '@segment/analytics-next';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MonitorService {
  private analytics: AnalyticsBrowser | undefined;
  private readonly disallowedPropertyPattern =
    /address|wallet|email|ip|device|session|token|secret|private|mnemonic|seed|signature|authorization|tx|transaction|hash/i;

  constructor(private router: Router) {
    if (this.isTrackingEnabled() && environment.segmentKey) {
      this.analytics = AnalyticsBrowser.load({
        writeKey: environment.segmentKey,
      });
      this.trackPageView(window.location.pathname);
      this.router.events
        .pipe(
          filter(
            (event): event is NavigationEnd => event instanceof NavigationEnd,
          ),
        )
        .subscribe((event) => this.trackPageView(event.urlAfterRedirects));
    }
  }

  trackPageView(route: string) {
    this.track('Page Viewed', {
      route: this.sanitizeRoute(route),
      page_category: this.getPageCategory(route),
    });
  }

  track(event: string, properties?: Record<string, unknown>) {
    if (!this.analytics) return;

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
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Error) {
      return {
        error_code: value.name || 'Error',
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
        if (this.disallowedPropertyPattern.test(key)) return safe;
        safe[key] = this.normalizeProperties(entry);
        return safe;
      }, {});
    }
    return value;
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
    if (!environment.segmentKey) return false;
    if (!environment.isProduction) return false;
    const hostname = window.location.hostname;
    return (
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname) &&
      !hostname.endsWith('.local')
    );
  }

  private sanitizeRoute(route: string): string {
    return (route || '/').split('?')[0].split('#')[0] || '/';
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
