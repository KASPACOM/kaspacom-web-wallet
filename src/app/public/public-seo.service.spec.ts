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
    meta.removeTag('name="twitter:card"');
    meta.removeTag('name="twitter:title"');
    meta.removeTag('name="twitter:description"');
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

    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    expect(canonical?.href).toBe('https://wallet.kaspa.com/faq');

    const jsonLd = document.querySelector<HTMLScriptElement>(
      'script[data-public-json-ld="true"]',
    );
    expect(jsonLd).not.toBeNull();

    const parsed = JSON.parse(jsonLd!.textContent ?? '{}');
    const faqGraph = parsed['@graph'].find(
      (item: Record<string, unknown>) => item['@type'] === 'FAQPage',
    );
    expect(faqGraph.mainEntity.length).toBe(PUBLIC_FAQ_ENTRIES.length);
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
