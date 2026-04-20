# Wallet E2E Tests

## Why

The wallet has **zero E2E tests**. Unit test coverage is 7 spec files, none of which exercise full user flows. Recent `develop` fix-PRs expose the cost of this gap:

| PR | Regression caught in prod |
|----|---------------------------|
| #191 | L1 approval flow broken |
| #189 | Missing RPC URL broke L2 |
| #185 | iframe embed broke on iOS Safari, Firefox, mobile overflow |
| #184 | KRC721 send list broke |
| #182 | ERC20 token import broke |
| #176 | L2 gas priority broken |
| #172 | Swap: 5-KAS reserve, wrap/unwrap 1:1, balance refresh |

Every one of these is a flow a Playwright test would execute on every PR. The central `KASPACOM/E2E-Tests` repo does not cover wallet features (only "connect wallet button visible"), so the wallet is a gap.

## What Changes

Add in-repo Playwright E2E suite at `e2e/`. Runs against TN10 L1 + Kasplex/IGRA testnet L2 using a pre-funded test wallet stored in GitHub Actions secrets. **Five suites, ~65 tests total**, across three browsers (Chromium, WebKit, Firefox) plus a mobile viewport for the iframe suite. Landing across five PRs:

- **PR 1 (merged first):** Infrastructure + onboarding suite + CI smoke gate (Chromium only)
- **PR 2:** Send L1 + L2 + on-chain verification + KNS resolution + QR scan
- **PR 3:** Swap + approval + iframe (adds WebKit + Firefox + mobile viewport projects)
- **PR 4:** Settings + token import + address book + pending-tx banner + asset detail + wallet switching
- **PR 5:** Nightly workflow + Test Engineer alert + mirror `@smoke` into `KASPACOM/E2E-Tests`

CI gate: `@smoke`-tagged subset runs on every PR (Chromium only, ~3 min). Full suite runs nightly across all browsers and reports failures to Telegram topic 51073.

## Impact

- **Affected specs:** new `testing/e2e` capability
- **Affected code:**
  - New `e2e/` folder (Playwright tests, fixtures, helpers)
  - New `playwright.config.ts` — gains WebKit + Firefox + Mobile Safari projects in PR 3
  - `package.json` — add `@playwright/test`, `dotenv`; add `e2e` / `e2e:smoke` / `e2e:all` / `e2e:mobile` scripts
  - `.github/workflows/pr-check.yml` — add `e2e-smoke` job
  - New `.github/workflows/e2e-nightly.yml` (PR 5) — full suite, all browsers, Telegram alert on failure
  - Minimal `data-testid` attributes added as selectors break under refactors (incremental)
- **No runtime dependency changes** — Playwright is devDependency only.
- **New secret required:** `KASPA_E2E_SEED` (TN10 pre-funded wallet seed phrase) — gate for PR 2 onward.
