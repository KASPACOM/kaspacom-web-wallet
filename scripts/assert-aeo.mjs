import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist/wallet-front-new/browser');

const pages = [
  'index.html',
  'features/index.html',
  'security/index.html',
  'faq/index.html',
  'guides/best-kaspa-wallet/index.html',
  'guides/create-kaspa-wallet/index.html',
  'guides/kaspa-desktop-wallet/index.html',
  'guides/kaspa-wallet-app/index.html',
  'guides/store-kaspa/index.html',
];

const requiredBots = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'Googlebot',
];

function read(relativePath) {
  return readFileSync(join(browserDir, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of ['llms.txt', 'robots.txt', 'sitemap.xml']) {
  assert(existsSync(join(browserDir, file)), `${file} missing`);
}

const robots = read('robots.txt');
for (const bot of requiredBots) {
  assert(robots.includes(`User-agent: ${bot}`), `robots missing ${bot}`);
}

assert(read('llms.txt').includes('KaspaCom Wallet'), 'llms.txt missing brand');
assert(
  read('sitemap.xml').includes('https://wallet.kaspa.com/guides/best-kaspa-wallet'),
  'sitemap missing guide URL',
);

for (const page of pages) {
  const html = read(page);
  assert(html.includes('type="application/ld+json"'), `${page} missing JSON-LD`);
  assert(html.includes('Last reviewed:'), `${page} missing last reviewed date`);
  assert(html.includes('content="index, follow"'), `${page} missing production index/follow robots`);

  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert(jsonLd.length > 0, `${page} missing JSON-LD script`);
  for (const match of jsonLd) {
    JSON.parse(match[1]);
  }
}

console.log(`AEO artifact assertions passed for ${pages.length} routes.`);
