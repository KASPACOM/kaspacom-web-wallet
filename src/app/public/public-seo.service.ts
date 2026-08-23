import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { PublicFaqEntry, PublicPage } from './public-page.model';

const CANONICAL_ORIGIN = 'https://wallet.kaspa.com';

@Injectable({ providedIn: 'root' })
export class PublicSeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject<Document>(DOCUMENT);

  applyPage(page: PublicPage, faqs: PublicFaqEntry[]): void {
    const canonicalUrl = `${CANONICAL_ORIGIN}/${page.path}`.replace(/\/$/, '/');

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({
      name: 'robots',
      content: environment.isProduction ? 'index, follow' : 'noindex, nofollow',
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.setCanonical(canonicalUrl);
    this.setJsonLd(page, faqs, canonicalUrl);
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }

    link.href = href;
  }

  private setJsonLd(
    page: PublicPage,
    faqs: PublicFaqEntry[],
    canonicalUrl: string,
  ): void {
    this.document
      .querySelectorAll('script[data-public-json-ld="true"]')
      .forEach((node) => node.remove());

    const graph: unknown[] = [
      {
        '@type': 'Organization',
        '@id': `${CANONICAL_ORIGIN}/#organization`,
        name: 'KaspaCom',
        url: 'https://kaspa.com/',
      },
      {
        '@type': 'WebSite',
        '@id': `${CANONICAL_ORIGIN}/#website`,
        name: 'KaspaCom Wallet',
        url: CANONICAL_ORIGIN,
      },
      this.pageSchema(page, canonicalUrl),
    ];

    if (faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: faqs.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: entry.answer,
          },
        })),
      });
    }

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-public-json-ld', 'true');
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    this.document.head.appendChild(script);
  }

  private pageSchema(page: PublicPage, canonicalUrl: string): unknown {
    if (page.schemaType === 'WebApplication') {
      return {
        '@type': 'WebApplication',
        '@id': `${canonicalUrl}#wallet`,
        name: 'KaspaCom Wallet',
        url: canonicalUrl,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web browser',
        description: page.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      };
    }

    return {
      '@type': 'Article',
      '@id': `${canonicalUrl}#article`,
      headline: page.h1,
      url: canonicalUrl,
      description: page.description,
      author: {
        '@id': `${CANONICAL_ORIGIN}/#organization`,
      },
      publisher: {
        '@id': `${CANONICAL_ORIGIN}/#organization`,
      },
    };
  }
}
