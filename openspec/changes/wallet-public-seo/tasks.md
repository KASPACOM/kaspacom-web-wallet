# Tasks

## PR 1 - OpenSpec Proposal

- [x] Record keyword-backed scope and page map.
- [x] Define public SSG versus wallet CSR rendering split.
- [x] Document deployment status-code requirements.

## PR 2 - Code

- [ ] Create public-page manifest and content data.
- [ ] Add `PublicShellComponent` and public page components.
- [ ] Move browser-only root startup into `WalletShellComponent`.
- [ ] Compose public routes and existing wallet routes without changing wallet URLs.
- [ ] Configure Angular server routes for prerendered public paths and client-rendered wallet paths.
- [ ] Add SEO metadata, canonical tags, Open Graph tags, robots handling, and JSON-LD.
- [ ] Generate sitemap from the public-page manifest.
- [ ] Add `404.html` and deployment notes for CloudFront/S3 routing.
- [ ] Run a production build and inspect generated HTML.

## PR 3 - Tests

- [ ] Unit test manifest uniqueness and canonical paths.
- [ ] Unit test FAQ visible data matches FAQPage JSON-LD.
- [ ] Unit test metadata service updates title, description, canonical, robots, and JSON-LD.
- [ ] Add build assertion script for prerendered public HTML.
- [ ] Add focused E2E smoke for `/`, `/faq`, `/security`, `/onboarding`, and `/app` deep links.
- [ ] Run `npm run build:dev`.
- [ ] Run focused unit tests and E2E smoke where local environment allows.

## Deployment Validation

- [ ] Deploy to dev only.
- [ ] `curl` every public page and confirm `200` with real HTML content.
- [ ] `curl` known wallet deep links and confirm `200` CSR shell.
- [ ] `curl` unknown public path and confirm real `404`.
- [ ] Confirm dev sends `X-Robots-Tag: noindex,nofollow`.
- [ ] Run Lighthouse SEO and schema validation on dev public pages.
- [ ] Promote to production only after Sione approves.
