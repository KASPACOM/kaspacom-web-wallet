# Tasks

## PR 1 — Infrastructure + Onboarding (this PR)

- [x] Scaffold `e2e/` folder and `playwright.config.ts`
- [x] Add `@playwright/test` + `dotenv` devDependencies
- [x] Add `e2e` and `e2e:smoke` npm scripts
- [x] Fixtures: test seed phrase, test private key (unfunded)
- [x] Helpers: wait for hydration, clear/seed localStorage, drive onboarding flow
- [x] Add `data-testid` attributes to onboarding landing, password step, seed step, verify step, import switch, seed-phrase import, private-key import, home balance, lock screen
- [x] `e2e/onboarding.spec.ts` — create wallet, import seed (12/24), import private key, password lock/unlock, invalid password, seed verification failure
- [x] Update `.github/workflows/pr-check.yml` — new `e2e-smoke` job
- [x] `e2e/README.md` — how to run locally, env vars, CI behavior

## PR 2 — Send (follow-up)

- [ ] Pre-funded testnet wallet seed added to GitHub secrets (`KASPA_E2E_SEED`)
- [ ] Helper: seed pre-funded wallet into storage
- [ ] `e2e/send.spec.ts` — L1 KAS, KRC20, KRC721, L2 KAS (WKAS), ERC20
- [ ] Fee estimation assertions
- [ ] Insufficient balance error path

## PR 3 — Swap + Approval + Iframe (follow-up)

- [ ] `e2e/swap.spec.ts` — quote, approval, 5 KAS reserve, wrap/unwrap 1:1, balance refresh after swap
- [ ] `e2e/approval.spec.ts` — L1 approval (regression test for #191), L2 approval
- [ ] `e2e/iframe.spec.ts` — iframe embed context, Safari UA, Firefox UA, mobile viewport `100dvh`

## PR 4 — Settings + Token Import (follow-up)

- [ ] `e2e/settings.spec.ts` — export seed/private key behind password, network switch, wallet deletion
- [ ] `e2e/token-import.spec.ts` — import ERC20 by address, reject invalid address, remove imported token, referral capture fire-and-forget

## Post-merge cleanup

- [ ] Mirror `@smoke` suite into `KASPACOM/E2E-Tests` so central nightly run also exercises wallet
- [ ] Alert Test Engineer topic (51073) on nightly failure
