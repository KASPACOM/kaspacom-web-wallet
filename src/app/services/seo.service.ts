import { DOCUMENT, Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const SITE_URL = 'https://wallet.kaspa.com';

export interface SeoPageConfig {
  title: string;
  description: string;
  /** Path starting with '/', e.g. '/faq'. Used for the canonical link and OG url. */
  path: string;
  /** Optional JSON-LD structured data object(s) to embed as <script type="application/ld+json">. */
  jsonLd?: object | object[];
}

/**
 * Centralizes per-page <title>/meta/canonical/JSON-LD so every content page
 * gets consistent, crawlable SEO tags. Safe to call during SSR/prerendering —
 * it only touches Title/Meta/DOCUMENT, never `window`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(
    null,
    null,
  );

  setPage(config: SeoPageConfig): void {
    const url = `${SITE_URL}${config.path}`;

    this.titleService.setTitle(`${config.title} | KaspaCom Wallet`);

    this.meta.updateTag({ name: 'description', content: config.description });
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({
      property: 'og:description',
      content: config.description,
    });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({
      name: 'twitter:description',
      content: config.description,
    });

    this.setCanonical(url);
    this.setJsonLd(config.jsonLd);
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = this.renderer.createElement('link') as HTMLLinkElement;
      this.renderer.setAttribute(link, 'rel', 'canonical');
      this.renderer.appendChild(this.document.head, link);
    }
    this.renderer.setAttribute(link, 'href', url);
  }

  private setJsonLd(jsonLd: object | object[] | undefined): void {
    const existing = this.document.querySelector(
      'script[data-seo-jsonld="true"]',
    );
    if (existing) {
      this.renderer.removeChild(this.document.head, existing);
    }

    if (!jsonLd) {
      return;
    }

    const script = this.renderer.createElement('script') as HTMLScriptElement;
    this.renderer.setAttribute(script, 'type', 'application/ld+json');
    this.renderer.setAttribute(script, 'data-seo-jsonld', 'true');
    this.renderer.appendChild(
      script,
      this.renderer.createText(JSON.stringify(jsonLd)),
    );
    this.renderer.appendChild(this.document.head, script);
  }
}
