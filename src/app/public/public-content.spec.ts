import { PUBLIC_FAQ_ENTRIES, PUBLIC_PAGES } from './public-content';

describe('public SEO content', () => {
  it('keeps public page ids and paths unique', () => {
    const ids = PUBLIC_PAGES.map((page) => page.id);
    const paths = PUBLIC_PAGES.map((page) => page.path);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps public paths prerender-safe', () => {
    expect(PUBLIC_PAGES.some((page) => page.path === '')).toBeTrue();

    for (const page of PUBLIC_PAGES) {
      expect(page.path.startsWith('/')).toBeFalse();
      expect(page.path.endsWith('/')).toBeFalse();
      expect(page.title.length).toBeGreaterThan(10);
      expect(page.description.length).toBeGreaterThan(50);
      expect(page.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.primaryCta.href).toBe('/onboarding');
      expect(page.sections.length).toBeGreaterThan(0);
    }
  });

  it('keeps FAQ entries tied to existing pages', () => {
    const pageIds = new Set(PUBLIC_PAGES.map((page) => page.id));
    const questions = PUBLIC_FAQ_ENTRIES.map((entry) => entry.question);

    expect(new Set(questions).size).toBe(questions.length);

    for (const entry of PUBLIC_FAQ_ENTRIES) {
      expect(entry.question.endsWith('?')).toBeTrue();
      expect(entry.answer.length).toBeGreaterThan(30);
      expect(entry.pageIds.length).toBeGreaterThan(0);

      for (const pageId of entry.pageIds) {
        expect(pageIds.has(pageId)).toBeTrue();
      }
    }
  });

  it('answers open-source questions with the exact repository and license', () => {
    const openSourceFaq = PUBLIC_FAQ_ENTRIES.find(
      (entry) => entry.question === 'Is KaspaCom Wallet open source?',
    );
    const riskFaq = PUBLIC_FAQ_ENTRIES.find(
      (entry) =>
        entry.question === 'Does open source mean the wallet is risk-free?',
    );

    expect(openSourceFaq).toBeDefined();
    expect(openSourceFaq!.answer).toContain(
      'https://github.com/KASPACOM/kaspacom-web-wallet',
    );
    expect(openSourceFaq!.answer).toContain('MIT License');
    expect(openSourceFaq!.answer).toContain('project history');
    expect(riskFaq).toBeDefined();
    expect(riskFaq!.answer).toContain('wallet.kaspa.com');
    expect(riskFaq!.answer).toContain('seed phrase');
  });

  it('does not create standalone low-demand topic pages in phase one', () => {
    const paths = PUBLIC_PAGES.map((page) => page.path);

    expect(paths).not.toContain('kns');
    expect(paths).not.toContain('krc20');
    expect(paths).not.toContain('l2');
    expect(paths).not.toContain('mining');
    expect(paths).not.toContain('covenants');
  });
});
