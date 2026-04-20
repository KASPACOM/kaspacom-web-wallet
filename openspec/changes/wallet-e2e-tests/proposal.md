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

Add in-repo Playwright E2E suite at `e2e/`. Runs against TN10 L1 + Kasplex/IGRA testnet L2 using a pre-funded test wallet stored in GitHub Actions secrets. Six suites, ~40 tests total, landed across multiple PRs:

- **PR 1 (this proposal):** Infrastructure + onboarding suite + CI
- **PR 2:** Send L1 + L2
- **PR 3:** Swap + approval + iframe
- **PR 4:** Settings + token import

CI gate: `@smoke`-tagged subset runs on every PR; full suite runs nightly.

## Impact

- **Affected specs:** new `testing/e2e` capability
- **Affected code:**
  - New `e2e/` folder (Playwright tests, fixtures, helpers)
  - New `playwright.config.ts`
  - `package.json` — add `@playwright/test`, `dotenv`; add `e2e`/`e2e:smoke` scripts
  - `.github/workflows/pr-check.yml` — add e2e job
  - Minimal `data-testid` attributes added to key interactive elements in onboarding/home (no visual or behavioral change)
- **No runtime dependency changes** — Playwright is devDependency only.
