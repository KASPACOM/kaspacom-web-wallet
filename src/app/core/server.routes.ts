import { RenderMode, ServerRoute } from '@angular/ssr';
import contentRoutes from '../pages/content/content-routes.json';

// SEO/GEO content pages (FAQ, Features, Learn hub + articles) are prerendered
// to static HTML at build time so crawlers that don't execute JavaScript
// (search engines' text indexers, AI answer-engine bots) can read them
// directly. Everything else — the wallet app itself — keeps rendering purely
// client-side, unchanged from current behavior.
const contentPaths: string[] = [
  ...contentRoutes.pages.map((page) => page.path.replace(/^\//, '')),
  ...contentRoutes.articles.map((article) => `learn/${article.slug}`),
];

export const serverRoutes: ServerRoute[] = [
  ...contentPaths.map(
    (path): ServerRoute => ({ path, renderMode: RenderMode.Prerender }),
  ),
  { path: '**', renderMode: RenderMode.Client },
];
