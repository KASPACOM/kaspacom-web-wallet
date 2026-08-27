import { PublicFaqEntry, PublicPage } from './public-page.model';

// Default review date for pages whose content hasn't changed since this batch.
// When editing a single page's copy, set that page's `lastReviewed` to the new
// date directly instead of bumping this shared constant for every page.
export const PUBLIC_CONTENT_LAST_REVIEWED = '2026-08-26';

export const OPEN_WALLET_CTA = {
  label: 'Open Wallet',
  href: '/onboarding',
  variant: 'primary' as const,
};

const FEATURES_SECTION = {
  title: 'What you can do in KaspaCom Wallet',
  body: [
    'Use KaspaCom Wallet to create or import a browser wallet, receive KAS, send payments, manage assets, and connect to KaspaCom products from one place.',
  ],
  bullets: [
    'Create or import a self-custody Kaspa wallet.',
    'Send and receive KAS on Kaspa L1.',
    'View supported tokens, NFTs, and other asset records where enabled.',
    'Use built-in swap flows where supported.',
    'Manage L2 assets on supported Kaspa L2 networks.',
    'Preview covenant tools in development environments when enabled.',
  ],
};

const SECURITY_SECTION = {
  title: 'Self-custody means you control the keys',
  body: [
    'KaspaCom Wallet is non-custodial. Your seed phrase and private keys belong to you. The wallet stores encrypted wallet data in your browser and does not ask you to send your seed phrase to KaspaCom servers.',
    'Back up your seed phrase before using the wallet with real funds. If browser storage is cleared and you do not have the seed phrase, the wallet cannot recover the funds for you.',
  ],
};

export const PUBLIC_PAGES: PublicPage[] = [
  {
    id: 'home',
    path: '',
    title: 'Kaspa Wallet | KaspaCom Web Wallet',
    description:
      'Open a self-custody Kaspa wallet in your browser. Send, receive, store, and manage KAS with KaspaCom Web Wallet.',
    h1: 'Kaspa Wallet',
    intro:
      'KaspaCom Wallet is a self-custody browser wallet for KAS. Create a wallet, import an existing seed phrase, receive funds, send payments, and manage supported Kaspa assets from wallet.kaspa.com.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa wallet',
    secondaryKeywords: ['kaspa web wallet', 'wallet kaspa', 'kaspa online wallet'],
    sitemapPriority: '1.0',
    changeFrequency: 'weekly',
    schemaType: 'WebApplication',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      FEATURES_SECTION,
      SECURITY_SECTION,
      {
        title: 'Choose the wallet task you need',
        body: [
          'Use the wallet to create a new address, open an existing wallet, receive KAS, send a payment, or review the safety model before storing funds.',
          'When you are ready to use the wallet, the Open Wallet button takes you to the client-side wallet flow.',
        ],
        cta: OPEN_WALLET_CTA,
      },
    ],
  },
  {
    id: 'features',
    path: 'features',
    title: 'Kaspa Wallet Features | KaspaCom Web Wallet',
    description:
      'See the KaspaCom Wallet feature set: KAS send and receive, asset views, swaps, L2 support, and development covenant tools.',
    h1: 'KaspaCom Wallet Features',
    intro:
      'KaspaCom Wallet focuses on the core wallet jobs first: create or import a wallet, receive KAS, send KAS, manage supported assets, and connect to KaspaCom apps.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa wallet features',
    secondaryKeywords: ['kaspa wallet app', 'kaspa coin wallet', 'kaspa crypto wallet'],
    sitemapPriority: '0.8',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      FEATURES_SECTION,
      {
        title: 'L1, L2, and asset support',
        body: [
          'The wallet supports KAS on Kaspa L1 and includes views for supported Kaspa assets. L2 networks and swap flows appear where the configured network supports them.',
          'Asset views and configured network features stay secondary to the core wallet flow: create or import, receive, send, and protect the seed phrase.',
        ],
      },
      {
        title: 'Covenant tools',
        body: [
          'The codebase includes covenant templates such as vault, escrow with arbiter, multi-signature vault, time-lock vault, and dead man switch patterns.',
          'Public copy should call these preview or development features until the production route is enabled and tested.',
        ],
        cta: OPEN_WALLET_CTA,
      },
    ],
  },
  {
    id: 'security',
    path: 'security',
    title: 'Kaspa Wallet Security | KaspaCom Web Wallet',
    description:
      'Learn how KaspaCom Wallet handles self-custody, seed phrases, browser storage, and official wallet safety.',
    h1: 'Kaspa Wallet Security',
    intro:
      'A Kaspa wallet is only safe when the seed phrase stays with the owner. KaspaCom Wallet is built as a self-custody browser wallet, so users control backup, device safety, and signing decisions.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa official wallet',
    secondaryKeywords: ['kaspa web wallet safe', 'kaspa wallet login', 'official kaspa wallet'],
    sitemapPriority: '0.8',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      SECURITY_SECTION,
      {
        title: 'How to check you are on the right site',
        body: [
          'Use the exact domain wallet.kaspa.com. Do not enter a seed phrase on copied domains, ads, support chats, or links sent by strangers.',
          'Bookmark the wallet after you verify the address. Search results and social links can change, but a saved bookmark reduces the risk of opening a fake page.',
        ],
      },
      {
        title: 'What happens if browser data is cleared',
        body: [
          'Browser wallets depend on local browser storage. If local storage is removed, the wallet data on that device can disappear.',
          'The seed phrase is the recovery path. Write it down and store it offline before sending funds to a new wallet.',
        ],
        cta: OPEN_WALLET_CTA,
      },
    ],
  },
  {
    id: 'faq',
    path: 'faq',
    title: 'Kaspa Wallet FAQ | KaspaCom Web Wallet',
    description:
      'Answers to common Kaspa wallet questions about web wallets, login, mobile use, desktop use, wallet addresses, storage, and safety.',
    h1: 'Kaspa Wallet FAQ',
    intro:
      'These answers focus on the wallet questions people already search for: web wallet, online wallet, app, download, login, address, official site, and safe storage.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa wallet faq',
    secondaryKeywords: ['kaspa wallet login', 'kaspa wallet address', 'kaspa online wallet'],
    sitemapPriority: '0.9',
    changeFrequency: 'weekly',
    schemaType: 'FAQPage',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      {
        title: 'Fast answers',
        body: [
          'Use the answers below to decide whether KaspaCom Wallet fits your wallet task. Each answer is short by design and links users back to the wallet when they are ready.',
        ],
      },
    ],
  },
  {
    id: 'best-wallet',
    path: 'guides/best-kaspa-wallet',
    title: 'Best Kaspa Wallet: How to Choose | KaspaCom',
    description:
      'Compare Kaspa wallet options and learn where a browser wallet fits for self-custody, speed, device access, and daily use.',
    h1: 'Best Kaspa Wallet',
    intro:
      'The best Kaspa wallet depends on the job. A browser wallet is useful for fast access and daily transfers. Hardware or cold storage may fit larger long-term holdings.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'best kaspa wallet',
    secondaryKeywords: ['which wallet supports kaspa', 'kaspa hot wallet', 'kaspa cold wallet'],
    sitemapPriority: '0.8',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      {
        title: 'When a browser wallet fits',
        body: [
          'Use a browser wallet when you want quick access from a trusted device, need to send or receive KAS, or want to connect to KaspaCom products.',
        ],
        bullets: [
          'Good for daily wallet tasks.',
          'Good for small active balances.',
          'Good for users who want no native app install.',
        ],
      },
      {
        title: 'When to use colder storage',
        body: [
          'For large balances, long holding periods, or shared custody policies, consider storage that reduces day-to-day browser and device exposure.',
        ],
      },
      SECURITY_SECTION,
    ],
  },
  {
    id: 'wallet-app',
    path: 'guides/kaspa-wallet-app',
    title: 'Kaspa Wallet App: Browser and Mobile Use | KaspaCom',
    description:
      'KaspaCom Wallet is a mobile-friendly browser wallet for Kaspa. Learn how app, iOS, Android, and mobile wallet searches map to wallet.kaspa.com.',
    h1: 'Kaspa Wallet App',
    intro:
      'KaspaCom Wallet runs in the browser. That means mobile users can open wallet.kaspa.com from a phone browser without installing a native iOS or Android app.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa wallet app',
    secondaryKeywords: ['kaspa mobile wallet', 'kaspa wallet android', 'kaspa wallet ios'],
    sitemapPriority: '0.7',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      {
        title: 'Is there a KaspaCom native app?',
        body: [
          'KaspaCom Wallet is a web wallet, not a native iOS or Android app in this phase. Open it from a browser on mobile or desktop.',
        ],
      },
      {
        title: 'Mobile wallet safety',
        body: [
          'Only use a phone you control. Keep the browser, operating system, and device lock updated. Never paste your seed phrase into another site or support chat.',
        ],
        cta: OPEN_WALLET_CTA,
      },
    ],
  },
  {
    id: 'desktop-wallet',
    path: 'guides/kaspa-desktop-wallet',
    title: 'Kaspa Desktop Wallet and Download Questions | KaspaCom',
    description:
      'Learn how KaspaCom Wallet handles desktop, Windows, Chrome, and download intent as a browser wallet at wallet.kaspa.com.',
    h1: 'Kaspa Desktop Wallet',
    intro:
      'KaspaCom Wallet does not require a desktop download. It opens in a desktop browser, including Chrome and other modern browsers that support secure crypto APIs.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'kaspa desktop wallet',
    secondaryKeywords: ['kaspa wallet download', 'kaspa wallet windows', 'kaspa wallet chrome'],
    sitemapPriority: '0.7',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      {
        title: 'Do I need to download a Kaspa wallet?',
        body: [
          'You do not need to download KaspaCom Wallet. Open wallet.kaspa.com in a modern browser and create or import a wallet there.',
        ],
      },
      {
        title: 'Desktop browser checklist',
        body: [
          'Use the official domain, avoid copied download links, keep your browser updated, and back up your seed phrase before receiving funds.',
        ],
        cta: OPEN_WALLET_CTA,
      },
    ],
  },
  {
    id: 'create-wallet',
    path: 'guides/create-kaspa-wallet',
    title: 'Create a Kaspa Wallet | KaspaCom Guide',
    description:
      'Create a self-custody Kaspa wallet in the browser and learn how to back up the seed phrase before receiving KAS.',
    h1: 'Create a Kaspa Wallet',
    intro:
      'Creating a Kaspa wallet gives you a new seed phrase and wallet address. Back up the seed phrase before sending funds to the wallet.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'create kaspa wallet',
    secondaryKeywords: ['wallet for kaspa', 'kaspa wallet address', 'kaspa online wallet'],
    sitemapPriority: '0.8',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      {
        title: 'Steps',
        body: ['Open the wallet, choose the create flow, write down the seed phrase, confirm the backup, then copy your receive address.'],
        bullets: [
          'Open wallet.kaspa.com.',
          'Choose create wallet.',
          'Write the seed phrase offline.',
          'Confirm the backup.',
          'Use the receive screen to copy your Kaspa address.',
        ],
      },
      SECURITY_SECTION,
    ],
  },
  {
    id: 'store-kaspa',
    path: 'guides/store-kaspa',
    title: 'How to Store Kaspa | KaspaCom Wallet Guide',
    description:
      'Learn how to store Kaspa with self-custody, browser wallet safety, seed phrase backup, and device hygiene.',
    h1: 'How to Store Kaspa',
    intro:
      'To store Kaspa, use a wallet where you control the seed phrase, back it up offline, and keep wallet access limited to devices you trust.',
    lastReviewed: PUBLIC_CONTENT_LAST_REVIEWED,
    primaryKeyword: 'store kaspa',
    secondaryKeywords: ['how to store kaspa', 'kaspa self custody', 'kaspa wallet safety'],
    sitemapPriority: '0.7',
    changeFrequency: 'monthly',
    schemaType: 'Article',
    primaryCta: OPEN_WALLET_CTA,
    sections: [
      SECURITY_SECTION,
      {
        title: 'Active funds and long-term funds',
        body: [
          'A browser wallet fits active funds you plan to use. For larger balances, split storage by risk and avoid keeping every coin in one hot wallet.',
        ],
      },
    ],
  },
];

export const PUBLIC_FAQ_ENTRIES: PublicFaqEntry[] = [
  {
    question: 'What is KaspaCom Wallet?',
    answer:
      'KaspaCom Wallet is a self-custody browser wallet for Kaspa. It lets users create or import a wallet, receive KAS, send KAS, and manage supported Kaspa assets from wallet.kaspa.com.',
    pageIds: ['faq', 'home'],
  },
  {
    question: 'Is KaspaCom Wallet a web wallet?',
    answer:
      'Yes. KaspaCom Wallet is a web wallet that runs in the browser. Public pages are static, but wallet creation, import, storage, and signing happen client-side.',
    pageIds: ['faq', 'home'],
  },
  {
    question: 'Where do I open the Kaspa web wallet?',
    answer:
      'Open the wallet at wallet.kaspa.com. Check the domain before entering a password or seed phrase.',
    pageIds: ['faq'],
  },
  {
    question: 'Does KaspaCom Wallet have a mobile app?',
    answer:
      'KaspaCom Wallet is a mobile-friendly browser wallet. It is not a native iOS or Android app in this phase.',
    pageIds: ['faq', 'wallet-app'],
  },
  {
    question: 'Do I need to download KaspaCom Wallet?',
    answer:
      'No. KaspaCom Wallet opens in a modern browser. Avoid copied download links that claim to be KaspaCom Wallet installers.',
    pageIds: ['faq', 'desktop-wallet'],
  },
  {
    question: 'How do I create a Kaspa wallet?',
    answer:
      'Open wallet.kaspa.com, choose the create wallet flow, write down the seed phrase offline, confirm the backup, and then use the receive screen to copy your address.',
    pageIds: ['faq', 'create-wallet'],
  },
  {
    question: 'What is a Kaspa wallet address?',
    answer:
      'A Kaspa wallet address is the public address you share to receive KAS. Do not share your seed phrase or private key.',
    pageIds: ['faq', 'create-wallet'],
  },
  {
    question: 'Is KaspaCom Wallet non-custodial?',
    answer:
      'Yes. KaspaCom Wallet is non-custodial. You control the seed phrase and private keys, and you are responsible for backup and device safety.',
    pageIds: ['faq', 'security'],
  },
  {
    question: 'Can KaspaCom recover my seed phrase?',
    answer:
      'No. If you lose the seed phrase, KaspaCom cannot recover it for you. Write it down and store it offline before receiving funds.',
    pageIds: ['faq', 'security'],
  },
  {
    question: 'What happens if I clear browser storage?',
    answer:
      'Clearing browser storage can remove wallet data from that device. Use your seed phrase to restore the wallet if you need to recover access.',
    pageIds: ['faq', 'security', 'store-kaspa'],
  },
  {
    question: 'Is KaspaCom Wallet the official Kaspa wallet?',
    answer:
      'KaspaCom Wallet is a KaspaCom wallet for Kaspa users. To avoid phishing, use wallet.kaspa.com and do not trust copied domains or ads that ask for your seed phrase.',
    pageIds: ['faq', 'security'],
  },
  {
    question: 'What is the best Kaspa wallet?',
    answer:
      'The best Kaspa wallet depends on the task. A browser wallet fits active use and daily transfers. Cold storage may fit larger long-term balances.',
    pageIds: ['faq', 'best-wallet'],
  },
  {
    question: 'Can I use KaspaCom Wallet on desktop?',
    answer:
      'Yes. Open wallet.kaspa.com from a modern desktop browser. There is no desktop installer required for KaspaCom Wallet in this phase.',
    pageIds: ['faq', 'desktop-wallet'],
  },
  {
    question: 'Can I store Kaspa in a browser wallet?',
    answer:
      'Yes, but treat a browser wallet as active hot-wallet storage. Keep your seed phrase offline and use trusted devices only.',
    pageIds: ['faq', 'store-kaspa'],
  },
  {
    question: 'Does KaspaCom Wallet support tokens or NFTs?',
    answer:
      'KaspaCom Wallet includes views for supported Kaspa assets such as tokens and NFTs. Availability can depend on the selected network and current product release.',
    pageIds: ['faq', 'features'],
  },
  {
    question: 'Does KaspaCom Wallet support L2 networks?',
    answer:
      'The wallet includes support for configured Kaspa L2 networks where available. Use the in-wallet network controls to see what is enabled in your environment.',
    pageIds: ['faq', 'features'],
  },
];

export function getPublicPageById(id: string | undefined): PublicPage {
  return PUBLIC_PAGES.find((page) => page.id === id) ?? PUBLIC_PAGES[0];
}

export function getPublicPageFaqs(pageId: string): PublicFaqEntry[] {
  if (pageId === 'faq') {
    return PUBLIC_FAQ_ENTRIES;
  }

  return PUBLIC_FAQ_ENTRIES.filter((entry) =>
    entry.pageIds.includes(pageId as PublicFaqEntry['pageIds'][number]),
  );
}
