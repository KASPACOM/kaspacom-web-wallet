import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

declare const KaspaConsentManager: any;
declare global {
  interface Window {
    analytics: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ConsentService {
  constructor(private router: Router) {
    this.init();
  }

  private init() {
    // Load the shared consent script (Runs in DEV too for verification, but in Debug Mode)
    const script = document.createElement('script');
    script.src = environment.consentScriptUrl || 'https://kaspa.com/js/modules/kaspa-consent.min.js';
    script.async = true;
    script.onload = () => {
      this.initManager();
    };
    script.onerror = () => {
      console.warn('Failed to load KaspaConsentManager');
    };
    document.body.appendChild(script);

    // CSS for the banner is likely needed if not present in global styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = environment.consentCssUrl || 'https://kaspa.com/css/style.min.css';
    document.head.appendChild(link);
  }

  private initManager() {
    if (typeof KaspaConsentManager !== 'undefined') {
       KaspaConsentManager.init({
          segmentKey: (environment as any).segmentKey,
          clarityKey: (environment as any).clarityKey,
          addressableKey: (environment as any).addressableKey,
          debugMode: !environment.isProduction
       });

       // Track subsequent navigations
       this.router.events.pipe(
         filter((event): event is NavigationEnd => event instanceof NavigationEnd)
       ).subscribe((event) => {
          if (window.analytics) {
             window.analytics.page(event.urlAfterRedirects);
          }
       });
    }
  }
}
