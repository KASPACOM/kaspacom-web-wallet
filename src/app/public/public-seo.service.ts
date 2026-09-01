import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { PublicFaqEntry, PublicPage } from './public-page.model';

const CANONICAL_ORIGIN = 'https://wallet.kaspa.com';
const WALLET_REPOSITORY = 'https://github.com/KASPACOM/kaspacom-web-wallet';
const WALLET_LICENSE = 'https://opensource.org/license/mit';
const SOCIAL_IMAGE = `${CANONICAL_ORIGIN}/images/kc-logo-square.png`;
const KASPACOM_SAME_AS = [
  'https://x.com/KaspaCom',
  'https://t.me/KaspaComOfficial',
  'https://github.com/KASPACOM',
  'https://kaspacom.gitbook.io/kaspacom',
];

@Injectable({ providedIn: 'root' })
export class PublicSeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject<Document>(DOCUMENT);

  applyPage(page: PublicPage, faqs: PublicFaqEntry[]): void {
    const canonicalUrl = this.canonicalUrl(page);

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({
      name: 'robots',
      content: environment.isProduction ? 'index, follow' : 'noindex, nofollow',
    });
    this.meta.updateTag({
      property: 'og:type',
      content: page.schemaType === 'Article' ? 'article' : 'website',
    });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:site_name', content: 'KaspaCom Wallet' });
    this.meta.updateTag({ property: 'og:locale', content: 'en_US' });
    this.meta.updateTag({ property: 'og:image', content: SOCIAL_IMAGE });
    this.meta.updateTag({ property: 'og:image:width', content: '1024' });
    this.meta.updateTag({ property: 'og:image:height', content: '1024' });
    this.meta.updateTag({ property: 'og:image:type', content: 'image/png' });
    this.meta.updateTag({
      property: 'og:image:alt',
      content: 'KaspaCom Wallet logo',
    });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:image', content: SOCIAL_IMAGE });
    this.meta.updateTag({
      name: 'twitter:image:alt',
      content: 'KaspaCom Wallet logo',
    });
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
        logo: 'https://wallet.kaspa.com/logo.png',
        sameAs: KASPACOM_SAME_AS,
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@kaspa.com',
          contactType: 'customer support',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${CANONICAL_ORIGIN}/#website`,
        name: 'KaspaCom Wallet',
        url: CANONICAL_ORIGIN,
        publisher: {
          '@id': `${CANONICAL_ORIGIN}/#organization`,
        },
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${CANONICAL_ORIGIN}/#source`,
        name: 'KaspaCom Wallet source code',
        codeRepository: WALLET_REPOSITORY,
        license: WALLET_LICENSE,
        programmingLanguage: ['TypeScript', 'HTML', 'SCSS'],
        author: {
          '@id': `${CANONICAL_ORIGIN}/#organization`,
        },
        about: {
          '@id': `${CANONICAL_ORIGIN}/#wallet`,
        },
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

    if (page.path) {
      graph.push(this.breadcrumbSchema(page, canonicalUrl));
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
        sameAs: [WALLET_REPOSITORY],
        license: WALLET_LICENSE,
        subjectOf: {
          '@id': `${CANONICAL_ORIGIN}/#source`,
        },
        datePublished: page.lastReviewed,
        dateModified: page.lastReviewed,
        publisher: {
          '@id': `${CANONICAL_ORIGIN}/#organization`,
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      };
    }

    if (page.schemaType === 'FAQPage') {
      return {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        name: page.h1,
        url: canonicalUrl,
        description: page.description,
        dateModified: page.lastReviewed,
        isPartOf: {
          '@id': `${CANONICAL_ORIGIN}/#website`,
        },
        publisher: {
          '@id': `${CANONICAL_ORIGIN}/#organization`,
        },
      };
    }

    return {
      '@type': 'Article',
      '@id': `${canonicalUrl}#article`,
      headline: page.h1,
      url: canonicalUrl,
      description: page.description,
      datePublished: page.lastReviewed,
      dateModified: page.lastReviewed,
      author: {
        '@id': `${CANONICAL_ORIGIN}/#organization`,
      },
      publisher: {
        '@id': `${CANONICAL_ORIGIN}/#organization`,
      },
    };
  }

  private breadcrumbSchema(page: PublicPage, canonicalUrl: string): unknown {
    return {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'KaspaCom Wallet',
          item: `${CANONICAL_ORIGIN}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.h1,
          item: canonicalUrl,
        },
      ],
    };
  }

  private canonicalUrl(page: PublicPage): string {
    return page.path ? `${CANONICAL_ORIGIN}/${page.path}` : `${CANONICAL_ORIGIN}/`;
  }
}
