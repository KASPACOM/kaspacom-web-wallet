# Wallet Public SEO Pages

## Why

`wallet.kaspa.com` currently serves the interactive wallet as a client-rendered app. Google sees the domain, but the crawlable surface is thin and the current query data shows the site is under-positioned for its strongest intent: `kaspa wallet`, `kaspa web wallet`, and related app, login, safety, address, and download searches.

The goal is to make the public wallet surface crawlable without moving wallet secrets, signing, WASM, IndexedDB, localStorage, iframe communication, or authenticated wallet behavior into server rendering. Public pages should be static HTML. Wallet routes should stay client-side.

## What Changes

- Add crawlable public pages for wallet-led SEO and GEO.
- Split the root app into a server-safe public shell and a browser-only wallet shell.
- Use Angular SSG for public pages and CSR for wallet/onboarding routes.
- Add route metadata, canonical URLs, JSON-LD, FAQ data, sitemap generation, and robots handling.
- Fix deployment guidance for S3 and CloudFront deep-link status codes.

## Capabilities

### New Capabilities

- `wallet-public-homepage` - Static homepage targeting `kaspa wallet` and `kaspa web wallet`.
- `wallet-public-faq` - Static FAQ covering wallet, login, app, download, safety, address, and storage queries.
- `wallet-public-guides` - Static guides for best wallet, app/mobile use, desktop/download intent, create wallet, and store Kaspa.
- `wallet-seo-manifest` - One typed manifest for public routes, titles, descriptions, canonical URLs, schema, sitemap, and prerender entries.
- `wallet-hybrid-rendering` - Public routes prerendered at build time while wallet routes remain client-rendered.

### Modified Capabilities

- `wallet-routing` - `/` becomes a public wallet information page with `Open Wallet` CTAs to onboarding.
- `wallet-startup` - Browser-only startup moves behind wallet routes so public pages can render safely at build time.
- `wallet-deployment` - Static public routes and CSR wallet deep links get correct CloudFront/S3 behavior and HTTP status codes.

## Impact

- `src/app/app.component.*` - Reduce root app to a universal-safe router outlet.
- New: `src/app/public/**` - Public shell, pages, content data, metadata service, schema helpers.
- New: `src/app/wallet-shell/**` - Browser-only wrapper for existing wallet startup behavior.
- `src/app/core/app.config*.ts` - Add server route rendering and public route providers.
- `src/app/v2/v2.routes.ts` or replacement route composition - Preserve existing onboarding and `/app/**` routes under the wallet shell.
- `angular.json` - Enable prerender/static output for public routes.
- `public/sitemap.xml` and build script output - Generate sitemap from the manifest.
- New: deployment notes for S3 `404.html` and CloudFront path rewrite behavior.

## Stack

- Code: `feat/wallet-public-seo-code` (base = this branch)
- Tests: `feat/wallet-public-seo-tests` (base = code)

## Out of Scope

- No backend or CMS in this phase.
- No paid DataForSEO dependency.
- No native iOS, Android, or desktop app claims.
- No ranking promise for FAQ rich results.
- No production launch of covenant features unless the production route guard and E2E checks confirm they are live.
