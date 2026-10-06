import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist/wallet-front-new/browser');

const pages = [
  { path: '', title: 'Kaspa Web Wallet: Open Source & Self-Custody | KaspaCom', h1: 'Open-Source Kaspa Web Wallet' },
  { path: 'features', title: 'Kaspa Wallet Features | KaspaCom Web Wallet', h1: 'KaspaCom Wallet Features' },
  { path: 'security', title: 'Kaspa Wallet Security | KaspaCom Web Wallet', h1: 'Kaspa Wallet Security' },
  { path: 'faq', title: 'Kaspa Wallet FAQ | KaspaCom Web Wallet', h1: 'Kaspa Wallet FAQ' },
  { path: 'guides/best-kaspa-wallet', title: 'Best Kaspa Wallet: How to Choose | KaspaCom', h1: 'Best Kaspa Wallet' },
  { path: 'guides/kaspa-wallet-app', title: 'Kaspa Wallet App: Browser and Mobile Use | KaspaCom', h1: 'Kaspa Wallet App' },
  { path: 'guides/kaspa-desktop-wallet', title: 'Kaspa Desktop Wallet and Download Questions | KaspaCom', h1: 'Kaspa Desktop Wallet' },
  { path: 'guides/create-kaspa-wallet', title: 'Create a Kaspa Wallet | KaspaCom Guide', h1: 'Create a Kaspa Wallet' },
  { path: 'guides/store-kaspa', title: 'How to Store Kaspa | KaspaCom Wallet Guide', h1: 'How to Store Kaspa' },
];

function pageFile(pagePath) {
  return pagePath
    ? join(browserDir, pagePath, 'index.html')
    : join(browserDir, 'index.html');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractH1Text(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!match) {
    return null;
  }
  return match[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

assert(existsSync(browserDir), `Missing build output: ${browserDir}`);

const homeHtml = readFileSync(pageFile(''), 'utf8');
assert(
  homeHtml.includes('https://github.com/KASPACOM/kaspacom-web-wallet'),
  'Home page missing exact wallet repository URL',
);
assert(homeHtml.includes('open-source'), 'Home page missing open-source wording');
assert(
  homeHtml.includes('https://wallet.kaspa.com/images/kc-logo-square.png'),
  'Home page missing social image metadata',
);

for (const guidePath of [
  '/guides/best-kaspa-wallet',
  '/guides/kaspa-wallet-app',
  '/guides/kaspa-desktop-wallet',
  '/guides/create-kaspa-wallet',
  '/guides/store-kaspa',
]) {
  assert(homeHtml.includes(`href="${guidePath}"`), `Home page missing guide link ${guidePath}`);
}

for (const page of pages) {
  const file = pageFile(page.path);
  assert(existsSync(file), `Missing prerendered HTML: ${file}`);

  const html = readFileSync(file, 'utf8');
  const encodedTitle = page.title.replaceAll('&', '&amp;');
  assert(html.includes(`<title>${encodedTitle}</title>`), `Missing title for ${page.path || '/'}`);
  assert(extractH1Text(html) === page.h1, `Missing H1 for ${page.path || '/'}`);
  assert(html.includes('rel="canonical"'), `Missing canonical for ${page.path || '/'}`);
  assert(html.includes('application/ld+json'), `Missing JSON-LD for ${page.path || '/'}`);
  assert(html.includes('Open Wallet'), `Missing Open Wallet CTA for ${page.path || '/'}`);
  assert(html.includes('app-public-page'), `Missing prerendered public component for ${page.path || '/'}`);
}

const csrFile = join(browserDir, 'index.csr.html');
assert(existsSync(csrFile), 'Missing CSR shell index.csr.html');

const csrHtml = readFileSync(csrFile, 'utf8');
assert(
  csrHtml.includes('content="noindex, nofollow"'),
  'CSR shell must stay noindex,nofollow',
);
assert(
  !csrHtml.includes('app-public-page'),
  'CSR shell must not contain public page prerender output',
);

console.log(`Public prerender assertions passed for ${pages.length} routes.`);
