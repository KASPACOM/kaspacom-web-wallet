# Design

## Context

Search Console, Trends, and Keyword Planner data point to one clear phase-one target: wallet intent. `kaspa wallet` has the largest volume and weak average position. `kaspa web wallet` has smaller volume but stronger CTR. App, mobile, download, desktop, official, login, safety, address, and create-wallet queries are secondary intents.

KNS, KRC20, L2, mining, and covenant terms do not currently show enough search demand to justify standalone SEO pages. They belong in product feature copy for now.

## Goals / Non-Goals

**Goals**

- Serve meaningful static HTML for public pages.
- Keep private keys, mnemonics, signing, local wallet state, WASM, iframe communication, and wallet services in browser-only routes.
- Preserve existing onboarding and authenticated wallet routes.
- Target the keyword clusters proven by GSC, Trends, and Keyword Planner.
- Give crawlers clear titles, descriptions, canonicals, schema, sitemap entries, and internal links.

**Non-Goals**

- Build a CMS.
- Add a Node runtime requirement for phase one.
- Advertise native app or desktop download support.
- Target low-demand feature keywords as standalone pages.
- Change backend APIs.
- Deploy production before dev validation.

## Decisions

### 1. Public pages use SSG, wallet routes use CSR

Public routes are static content and should be prerendered at build time. Wallet routes need browser APIs, encrypted local storage, live network services, iframe communication, and signing behavior, so they remain client-rendered.

Rejected alternative: SSR everything. That would force browser-only wallet code into the server path or require many defensive guards across unrelated wallet modules.

### 2. Root component becomes universal-safe

The root app should not inject wallet services. It should render a router outlet. Browser-only startup moves into `WalletShellComponent`, which wraps onboarding, `/app/**`, and legacy wallet routes.

This creates a small interface: public routes do not need to know anything about wallet startup, and wallet routes keep their current runtime behavior.

### 3. One public-page manifest owns SEO state

The manifest records path, title, description, canonical path, page type, prerender eligibility, CTA labels, schema type, and sitemap priority.

The same data should drive route registration, page navigation, metadata, JSON-LD, and sitemap generation. That keeps metadata changes local and testable.

### 4. Page map follows actual demand

Phase one pages:

- `/` - `kaspa wallet`, `kaspa web wallet`
- `/features` - wallet product features, with KRC20, KRC721, KNS, L2, swaps, and covenant previews as supporting feature copy
- `/security` - official wallet, safety, self-custody, seed phrase, browser storage
- `/faq` - wallet, login, online wallet, address, app, mobile, download, desktop, safety, storage
- `/guides/best-kaspa-wallet` - comparison intent
- `/guides/kaspa-wallet-app` - app/mobile/iOS/Android intent, answered honestly as mobile-friendly web wallet
- `/guides/kaspa-desktop-wallet` - desktop/download/Windows/Chrome intent, answered honestly as browser wallet
- `/guides/create-kaspa-wallet` - conversion intent
- `/guides/store-kaspa` - buy/store/self-custody intent

Deferred standalone pages: KNS, KRC20, L2, mining, and covenant topic pages.

### 5. CTAs point to onboarding

Primary CTA text is `Open Wallet`. It links to `/onboarding`, where the existing guard handles new and returning users.

### 6. Hosting must fix deep-link status codes

S3 currently returns `404` with an Angular shell body for wallet deep links. SEO work should not ship without routing behavior that returns:

- `200` for prerendered public pages.
- `200` for known CSR wallet prefixes.
- A real `404` for unknown public paths.

CloudFront viewer-request rewriting should map known extensionless public pages to their static `index.html` files and known wallet prefixes to the CSR shell. S3 website `ErrorDocument` should be `404.html`, not `index.html`.

## Proposed Flow

**Crawler requests `/faq`**

1. CloudFront rewrites `/faq` to the prerendered FAQ HTML.
2. The response has a `200` status, canonical URL, title, description, visible FAQ content, and FAQPage JSON-LD that matches visible text.

**User opens `/`**

1. Static homepage HTML loads fast and explains the wallet.
2. User clicks `Open Wallet`.
3. Browser navigates to `/onboarding`.
4. Wallet shell initializes browser-only wallet services.

**User opens `/app/home`**

1. CloudFront routes the known wallet prefix to the CSR shell.
2. The wallet shell initializes existing wallet behavior.
3. Auth guard and local wallet state work as before.

## Risks / Trade-offs

- Moving startup logic out of the root can break wallet initialization if any side effect is missed.
- Public pages can accidentally overclaim native app, desktop download, or covenant availability unless copy is constrained.
- Build output and CloudFront routing must be validated together because prerendered HTML alone does not fix bad HTTP status codes.
- FAQ schema should help machine interpretation, but Google FAQ rich results are restricted and should not be promised.

## Recommendation

Ship this in three stacked PRs:

1. OpenSpec proposal.
2. Code implementation: shell split, public pages, SSG, metadata, sitemap, and deployment notes.
3. Tests: manifest, metadata/schema parity, prerender output checks, and focused wallet route regression.
