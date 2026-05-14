# Design

## Location: in-repo vs central E2E-Tests

**Decision: in-repo `e2e/` folder as primary, mirror `@smoke` into central `E2E-Tests` for cross-repo nightly.**

| Option | Pros | Cons |
|--------|------|------|
| In-repo (primary) | PR-gated, no cross-repo coordination, tests land with the feature | Duplicates some infra vs central repo |
| Central `E2E-Tests` (mirror) | One place to view cross-system health | Can't block a wallet PR; requires coordinating two PRs per change |

The wallet ships independently, has its own CI, and its failure modes are regressions in its own code. Gating on PR is the point — that's what would have caught #191, #185, #182. Mirroring `@smoke` into `E2E-Tests` (PR 5) gives us a single cross-repo nightly dashboard without making the PR 1 critical path depend on it.

## Browser matrix

| Browser | PR | Why |
|---------|-----|-----|
| Chromium | PR 1 | Fastest, default developer browser; catches 80% of regressions |
| WebKit (Safari engine) | PR 3 | #185 was a Safari-specific localStorage bug — required |
| Firefox | PR 3 | #185 Firefox compatibility regression |
| Mobile Safari (iPhone 14 viewport) | PR 3 | #185 `100dvh` overflow was mobile-only |

PR smoke gate runs Chromium only (speed). Full suite runs all four nightly.

## Environment: testnet vs mocks

**Decision: live testnet (TN10 + Kasplex/IGRA testnet), pre-funded fixture wallet.**

Mocking the 6+ upstream APIs (Kaspa RPC, KaspaCom API, DeFi API, Kasplex, KNS, KRC721) would require 500+ lines of fixture JSON per test and would miss real breakage (e.g. PR #189's missing RPC URL — a mock would have been configured correctly and the test would have passed).

Onboarding tests need **no network** — they exercise local state only. Send/swap/approval tests need a funded wallet. We inject the seed via `KASPA_E2E_SEED` GitHub secret at CI time; locally, developers use their own via `.env.e2e`.

## On-chain verification (PR 2)

After UI-driven broadcast, a helper polls `https://api-tn10.kaspa.org/transactions/<hash>` (L1) or the chain's RPC `eth_getTransactionReceipt` (L2) with 2s backoff, max 30s. This catches "UI says sent but tx never landed" — a class of bug pure UI tests miss.

## Storage seeding strategy

The wallet uses `localStorage.userData` (AES-encrypted) + Dexie for UTXO cache. For tests that skip onboarding (send, swap, etc.), we pre-encrypt `userData` using the same `EncryptionService.encrypt(seed, password)` call the app uses, then `page.evaluate(() => localStorage.setItem(...))` before navigation. Dexie cache regenerates on first load.

## QR-code scanning (PR 2)

`html5-qrcode` consumes a `MediaStream` from the camera. In tests we use Playwright's `context.grantPermissions(['camera'])` and substitute a canvas-generated MediaStream via `navigator.mediaDevices.getUserMedia` monkey-patch. A fixture QR image encoding a known Kaspa address is drawn into the canvas.

## KNS resolution (PR 2)

Send tests cover three KNS paths: (1) known `.kas` domain resolves to address, (2) unknown domain shows "not found", (3) slow-resolving domain shows loading state. All hit real KNS testnet API (`api.knsdomains.org/tn10`).

## data-testid attributes

The current DOM has zero `data-testid`. Selectors like `kc-button:has-text("Continue")` work but break on copy edits. PR 1 deliberately adds no testids — we add them only when a test proves flaky, to avoid blanket churn. Convention: `data-testid="<feature>-<element>"` (e.g. `onboarding-create-btn`, `seed-word-input-0`).

## SSR hydration handling

Angular SSR with 600ms step transitions requires: `waitForFunction(() => !document.querySelector('[class*="transitioning"]'))` between steps. Helpers encapsulate this so individual tests stay readable.

## Dev server host binding (CI fix)

`ng serve` is configured in `angular.json` with `"host": "local.kaspa.com"` (a local dev convention requiring `/etc/hosts` entry). CI can't resolve that hostname. Playwright's `webServer.command` overrides with `--host 127.0.0.1 --disable-host-check`. Base URL also uses `127.0.0.1` (not `localhost`) to avoid IPv6 mismatches with the IPv4-only dev server.

## Nightly workflow + alerts (PR 5)

Separate `.github/workflows/e2e-nightly.yml` runs at 02:00 UTC across all four browsers. On failure, the workflow posts a summary (failed test names + artifact links) to Telegram topic `51073` (Test Engineer) using the KaspaCom bot's existing webhook — same pattern as the other 4 per-repo E2E nightly alerts.

## Scope creep guardrails

- **No retry logic for flaky network** — we fix flakes, not paper over them
- **No parallel test execution across files** (shared localStorage conflicts) — Playwright `fullyParallel: false` per project; CI scales via sharding if needed
- **No visual regression** (Percy/Chromatic) — add later if needed
- **No fuzz testing / property-based testing** — out of scope
- **No performance benchmarks** — separate concern, don't entangle with correctness tests
