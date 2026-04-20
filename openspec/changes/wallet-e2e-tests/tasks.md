# Tasks

## PR 1 — Infrastructure + Onboarding (merged first)

- [x] Scaffold `e2e/` folder and `playwright.config.ts`
- [x] Add `@playwright/test` + `dotenv` devDependencies
- [x] Add `e2e` and `e2e:smoke` npm scripts
- [x] Fixtures: test seed phrase, test private key (unfunded)
- [x] Helpers: wait for hydration, clear/seed localStorage, drive onboarding flow
- [x] `e2e/onboarding.spec.ts` — 10 tests: create (12/24), import seed (12/24), invalid seed, private key, login right/wrong password, checkbox gating
  - [x] 3 tests tagged `@smoke` in CI gate: landing, create, login-wrong-password
  - [x] PR 1.1: replace rejected BIP39 all-abandon test vector with freshly-generated valid mnemonics; re-tag `import via 12-word seed` as `@smoke`; wire `KASPA_E2E_SEED` org secret into CI env
- [x] Update `.github/workflows/pr-check.yml` — new `e2e-smoke` job (Chromium)
- [x] `e2e/README.md` — how to run locally, env vars, CI behavior
- [x] Fix dev-server host binding for CI (override `local.kaspa.com` → `127.0.0.1 --disable-host-check`)

## PR 2 — Send + On-Chain Verification + KNS + QR

Split into 2a–2e so each PR is independently ship-able.

### PR 2a — Funded-wallet auth + explorer helper + balance smoke

- [x] `KASPA_E2E_SEED` added as KASPACOM org secret
- [x] `getFundedSeed()` helper in `fixtures/wallet.ts` — self-skips when unset
- [x] `authenticateFundedWallet()` in `helpers/auth.ts` — drives import UI with funded seed
- [x] `readKasBalance()` + `readWalletAddress()` in `helpers/home.ts` — clipboard-based address read
- [x] `waitForTxConfirmed()` in `helpers/explorer.ts` — TN10 explorer poll (~60s deadline)
- [x] `fixtures/network.ts` — TN10 / Kasplex / IGRA endpoints + fallback addresses
- [x] `e2e/funded-wallet.spec.ts` — @funded balance + address smoke test
- [x] `e2e:funded` npm script
- [x] New `e2e-funded` CI job runs `@funded` tag, skips cleanly when secret unset

### PR 2b — Send KAS L1

- [ ] Pre-seed wallet state into localStorage helper (skip onboarding for speed)
- [ ] `send-l1.spec.ts` — send KAS happy path + insufficient balance
- [ ] On-chain verification via `waitForTxConfirmed`

### PR 2c — KRC20 + KRC721

- [ ] `send-krc20.spec.ts` (covers #172 reserve/wrap issues)
- [ ] `send-krc721.spec.ts` (covers #184 regression)
- [ ] Mint helper — ensure wallet has KRC20 + KRC721 before test

### PR 2d — L2 sends

- [ ] `send-l2.spec.ts` — L2 KAS (WKAS), ERC20
- [ ] Gas priority assertions (covers #176)

### PR 2e — KNS + QR

- [ ] `kns-send.spec.ts` — send by `.kas` domain
- [ ] Helper: fake camera stream for `html5-qrcode`
- [ ] `qr-send.spec.ts` — scan QR and pre-fill

## PR 3 — Swap + Approval + Iframe (multi-browser + mobile)

- [x] Extend `playwright.config.ts` with `webkit`, `firefox`, and `mobile-safari` (iPhone 14) projects
- [x] Add `e2e:webkit`, `e2e:firefox`, `e2e:mobile`, `e2e:smoke:all` npm scripts
- [x] `e2e-smoke` CI job becomes a matrix over all four projects
- [x] Chromium / WebKit / Firefox gate the PR (green)
- [ ] **mobile-safari stabilization (PR 3x)** — continue-on-error for now. Playwright stability check fails on kc-button inside the animated phone-frame; synthetic-click fallback helps landing test but not deeper flows. Debug locally with real iPhone 14 viewport to identify the blocking layout / animation and tighten the helper.
- [ ] `e2e/swap.spec.ts` — quote, approval, 5 KAS reserve, wrap/unwrap 1:1, balance refresh after swap (covers #172)
- [ ] `e2e/approval.spec.ts` — L1 approval (regression test for #191), L2 approval, revoke approval
- [ ] `e2e/iframe.spec.ts` — iframe embed context, Safari UA, Firefox UA, mobile viewport `100dvh`, localStorage bridge (covers #185)
- [ ] CI: add `e2e-smoke` matrix over `[chromium, webkit, firefox]` for iframe suite only

## PR 4 — Settings + Token Import + Address Book + Misc

### PR 4a — Settings (this PR)

- [x] `e2e/settings.spec.ts` — settings menu opens, export wallet password gate, delete wallet phrase validation
- [x] `helpers/settings.ts` — `openSettings()` / `closeSettings()`
- [ ] Export private key flow (separate entry point — defer to PR 4a.1 once we find the account-settings overlay entry)
- [ ] Network switch (dev-mode only, not on prod — lower priority)

### PR 4b — Token import (merged in #199)

- [x] `e2e/token-import.spec.ts` — opens import flow on L2, Look Up disabled on empty input, invalid-hex error (covers #182 entry-point regression). Full import + remove flow deferred until L2 RPC connection behavior is confirmed.
- [x] `helpers/network.ts` — `switchToL2()` (dev-mode network selector)
- [x] ~~`e2e/address-book.spec.ts`~~ — **feature does not exist in the wallet.** The send flow uses `address-smart-input` with KNS resolution, but there is no saved-contacts list, persistence, or contact-picker UI. Removed from scope.
- [ ] `e2e/pending-tx.spec.ts` — pending-transactions banner appears during broadcast and clears on confirmation
- [ ] `e2e/asset-detail.spec.ts` — click asset → detail view, transaction history drill-down, copy address
- [x] `e2e/multi-wallet.spec.ts` (PR 4c) — wallet-management opens via `.profile-container` click, active wallet renders with `.selected` modifier and a non-empty name
- [x] `helpers/wallet-management.ts` — `openWalletManagement()` via `.profile-container` click
- [ ] **PR 4c.1**: row-action icons (`.wallet-item__export` / `.wallet-item__trash`) + `.floating-orb` add-account dialog — initial selectors from explore didn't render as expected on a fresh wallet; needs local dev-server debug

## PR 5 — Nightly + Mirror + Alerts

### PR 5a — Nightly workflow + Telegram alert (this PR)

- [x] `.github/workflows/e2e-nightly.yml` — runs full suite across Chromium + WebKit + Firefox + Mobile Safari at 02:00 UTC
- [x] Nightly workflow posts failure summary to Telegram topic `51073` (Test Engineer) via bot webhook — pattern cribbed from `KASPACOM/E2E-Tests/.github/workflows/nightly.yml`
- [x] Merged blob reports into one HTML artifact per nightly run (14-day retention)

### PR 5b — Mirror into central E2E-Tests

- [ ] Add `wallet/` project to `KASPACOM/E2E-Tests/playwright.config.ts` covering the @smoke subset
- [ ] Update `E2E-Tests` nightly workflow matrix to include `wallet` alongside `defi` / `kaspiano` / `api`
- [ ] Update `E2E-Tests` README with cross-repo relationship
- [ ] Archive this OpenSpec change → `openspec/archive/`

## Post-merge hygiene

- [ ] Add `data-testid` attributes incrementally as selectors show flake (track in issue tracker)
- [ ] Rotate `KASPA_E2E_SEED` quarterly; monitor funded-wallet balance and top up via cron if needed
