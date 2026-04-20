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

- [ ] Extend `playwright.config.ts` with `webkit`, `firefox`, and `mobile-safari` (iPhone 14) projects
- [ ] Add `e2e:all` and `e2e:mobile` npm scripts
- [ ] `e2e/swap.spec.ts` — quote, approval, 5 KAS reserve, wrap/unwrap 1:1, balance refresh after swap (covers #172)
- [ ] `e2e/approval.spec.ts` — L1 approval (regression test for #191), L2 approval, revoke approval
- [ ] `e2e/iframe.spec.ts` — iframe embed context, Safari UA, Firefox UA, mobile viewport `100dvh`, localStorage bridge (covers #185)
- [ ] CI: add `e2e-smoke` matrix over `[chromium, webkit, firefox]` for iframe suite only

## PR 4 — Settings + Token Import + Address Book + Misc

- [ ] `e2e/settings.spec.ts` — export seed behind password, export private key behind password, network switch (TN10/Kasplex/IGRA), wallet deletion confirmation flow
- [ ] `e2e/token-import.spec.ts` — import ERC20 by address (covers #182), reject invalid address, remove imported token, referral capture fire-and-forget (covers #186)
- [ ] `e2e/address-book.spec.ts` — add / edit / delete contacts, use contact in send flow
- [ ] `e2e/pending-tx.spec.ts` — pending-transactions banner appears during broadcast and clears on confirmation
- [ ] `e2e/asset-detail.spec.ts` — click asset → detail view, transaction history drill-down, copy address
- [ ] `e2e/multi-wallet.spec.ts` — create second wallet, switch between wallets, balance updates per wallet

## PR 5 — Nightly + Mirror + Alerts

- [ ] `.github/workflows/e2e-nightly.yml` — runs full suite across Chromium + WebKit + Firefox + Mobile Safari at 02:00 UTC
- [ ] Nightly workflow posts failure summary to Telegram topic `51073` (Test Engineer) via existing bot webhook
- [ ] Mirror `@smoke` suite (onboarding + 1 send + 1 swap) into `KASPACOM/E2E-Tests` under new `wallet/` project so cross-repo nightly also exercises wallet
- [ ] Update `E2E-Tests` README + this `tasks.md` with the final cross-repo relationship
- [ ] Archive this OpenSpec change → `openspec/archive/`

## Post-merge hygiene

- [ ] Add `data-testid` attributes incrementally as selectors show flake (track in issue tracker)
- [ ] Rotate `KASPA_E2E_SEED` quarterly; monitor funded-wallet balance and top up via cron if needed
