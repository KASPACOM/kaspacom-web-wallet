// Regenerates public/sitemap.xml from the single source of truth for content
// routes (src/app/pages/content/content-routes.json), so the sitemap can
// never drift from the routes actually registered in the app. Runs before
// `ng build`, since angular.json copies public/** as a build asset.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const SITE_URL = 'https://wallet.kaspa.com';

const contentRoutes = JSON.parse(
  readFileSync(
    join(rootDir, 'src/app/pages/content/content-routes.json'),
    'utf-8',
  ),
);

const urls = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  ...contentRoutes.pages.map((page) => ({
    loc: page.path,
    changefreq: 'weekly',
    priority: '0.8',
  })),
  ...contentRoutes.articles.map((article) => ({
    loc: `/learn/${article.slug}`,
    changefreq: 'monthly',
    priority: '0.6',
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${SITE_URL}${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

writeFileSync(join(rootDir, 'public/sitemap.xml'), xml);
console.log(`Generated public/sitemap.xml with ${urls.length} URLs.`);
