export type PublicPageId =
  | 'home'
  | 'features'
  | 'security'
  | 'faq'
  | 'best-wallet'
  | 'wallet-app'
  | 'desktop-wallet'
  | 'create-wallet'
  | 'store-kaspa';

export interface PublicPageSection {
  eyebrow?: string;
  title: string;
  body: string[];
  bullets?: string[];
  cta?: PublicPageCta;
}

export interface PublicPageCta {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

export interface PublicPage {
  id: PublicPageId;
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  lastReviewed: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  sitemapPriority: string;
  changeFrequency: 'weekly' | 'monthly';
  schemaType: 'WebApplication' | 'FAQPage' | 'Article';
  primaryCta: PublicPageCta;
  secondaryCta?: PublicPageCta;
  sections: PublicPageSection[];
}

export interface PublicFaqEntry {
  question: string;
  answer: string;
  pageIds: PublicPageId[];
}
