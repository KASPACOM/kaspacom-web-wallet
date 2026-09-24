import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { PUBLIC_FAQ_ENTRIES, PUBLIC_PAGES } from './public-content';
import { PublicSeoService } from './public-seo.service';

describe('PublicSeoService', () => {
  let service: PublicSeoService;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PublicSeoService);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
  });

  afterEach(() => {
    document
      .querySelectorAll('script[data-public-json-ld="true"], link[rel="canonical"]')
      .forEach((node) => node.remove());
    meta.removeTag('name="description"');
    meta.removeTag('name="robots"');
    meta.removeTag('property="og:title"');
    meta.removeTag('property="og:description"');
    meta.removeTag('property="og:url"');
    meta.removeTag('property="og:type"');
    meta.removeTag('property="og:site_name"');
    meta.removeTag('property="og:locale"');
    meta.removeTag('property="og:image"');
    meta.removeTag('property="og:image:width"');
    meta.removeTag('property="og:image:height"');
    meta.removeTag('property="og:image:type"');
    meta.removeTag('property="og:image:alt"');
    meta.removeTag('name="twitter:card"');
    meta.removeTag('name="twitter:title"');
    meta.removeTag('name="twitter:description"');
    meta.removeTag('name="twitter:image"');
    meta.removeTag('name="twitter:image:alt"');
  });

  it('sets title, description, canonical, social tags, and JSON-LD', () => {
    const page = PUBLIC_PAGES.find((entry) => entry.id === 'faq');
    expect(page).toBeDefined();

    service.applyPage(page!, PUBLIC_FAQ_ENTRIES);

    expect(title.getTitle()).toBe(page!.title);
    expect(meta.getTag('name="description"')?.content).toBe(page!.description);
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://wallet.kaspa.com/faq',
    );
    expect(meta.getTag('property="og:type"')?.content).toBe('website');
    expect(meta.getTag('property="og:site_name"')?.content).toBe(
      'KaspaCom Wallet',
    );
    expect(meta.getTag('property="og:locale"')?.content).toBe('en_US');
    expect(meta.getTag('property="og:image"')?.content).toBe(
      'https://wallet.kaspa.com/images/kc-logo-square.png',
    );
    expect(meta.getTag('property="og:image:width"')?.content).toBe('1024');
    expect(meta.getTag('property="og:image:height"')?.content).toBe('1024');
    expect(meta.getTag('property="og:image:type"')?.content).toBe('image/png');
    expect(meta.getTag('property="og:image:alt"')?.content).toBe(
      'KaspaCom Wallet logo',
    );
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary');
    expect(meta.getTag('name="twitter:image"')?.content).toBe(
      'https://wallet.kaspa.com/images/kc-logo-square.png',
    );
    expect(meta.getTag('name="twitter:image:alt"')?.content).toBe(
      'KaspaCom Wallet logo',
    );

    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    expect(canonical?.href).toBe('https://wallet.kaspa.com/faq');

    const jsonLd = document.querySelector<HTMLScriptElement>(
      'script[data-public-json-ld="true"]',
    );
    expect(jsonLd).not.toBeNull();

    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    const organizationGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'Organization',
    );
    const webPageGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'WebPage',
    );
    const sourceGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'SoftwareSourceCode',
    );
    const articleGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'Article',
    );
    const faqGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'FAQPage',
    );
    const breadcrumbGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'BreadcrumbList',
    );

    expect(organizationGraph.sameAs).toContain('https://x.com/KaspaCom');
    expect(sourceGraph.codeRepository).toBe(
      'https://github.com/KASPACOM/kaspacom-web-wallet',
    );
    expect(sourceGraph.license).toBe(
      'https://opensource.org/license/mit',
    );
    expect(sourceGraph.programmingLanguage).toEqual([
      'TypeScript',
      'HTML',
      'SCSS',
    ]);
    expect(webPageGraph).toBeDefined();
    expect(webPageGraph.dateModified).toBe(page!.lastReviewed);
    expect(articleGraph).toBeUndefined();
    expect(faqGraph.mainEntity.length).toBe(PUBLIC_FAQ_ENTRIES.length);
    expect(breadcrumbGraph.itemListElement.length).toBe(2);
  });

  it('connects the web application schema to its repository and MIT license', () => {
    const home = PUBLIC_PAGES.find((entry) => entry.id === 'home')!;

    service.applyPage(home, []);

    const jsonLd = document.querySelector<HTMLScriptElement>(
      'script[data-public-json-ld="true"]',
    );
    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    const webApplication = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'WebApplication',
    );

    expect(webApplication.sameAs).toContain(
      'https://github.com/KASPACOM/kaspacom-web-wallet',
    );
    expect(webApplication.license).toBe(
      'https://opensource.org/license/mit',
    );
    expect(webApplication.subjectOf).toEqual({
      '@id': 'https://wallet.kaspa.com/#source',
    });
  });

  it('uses article Open Graph type only for article pages', () => {
    const features = PUBLIC_PAGES.find((entry) => entry.id === 'features')!;
    const faq = PUBLIC_PAGES.find((entry) => entry.id === 'faq')!;

    service.applyPage(features, []);
    expect(meta.getTag('property="og:type"')?.content).toBe('article');

    service.applyPage(faq, []);
    expect(meta.getTag('property="og:type"')?.content).toBe('website');
  });

  it('replaces the previous canonical and JSON-LD when navigating pages', () => {
    const home = PUBLIC_PAGES.find((entry) => entry.id === 'home')!;
    const security = PUBLIC_PAGES.find((entry) => entry.id === 'security')!;

    service.applyPage(home, []);
    service.applyPage(security, []);

    expect(
      document.querySelectorAll('script[data-public-json-ld="true"]').length,
    ).toBe(1);
    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe('https://wallet.kaspa.com/security');
  });
});
