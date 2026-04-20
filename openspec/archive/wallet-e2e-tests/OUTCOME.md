# Outcome — Wallet E2E Tests

Archived 2026-04-20. Twelve PRs shipped across `kaspacom-web-wallet` and `KASPACOM/E2E-Tests`.

## PRs

| # | Repo | Title |
|---|------|-------|
| 193 | kaspacom-web-wallet | Playwright infra + onboarding suite |
| 194 | kaspacom-web-wallet | Valid BIP39 fixture seeds + wire `KASPA_E2E_SEED` |
| 195 | kaspacom-web-wallet | PR 2a — funded-wallet auth + explorer helper + balance smoke |
| 197 | kaspacom-web-wallet | PR 3 — WebKit + Firefox + Mobile Safari browser matrix |
| 198 | kaspacom-web-wallet | PR 4a — settings suite (menu + export + delete) |
| 199 | kaspacom-web-wallet | PR 4b — token import entry + validation |
| 200 | kaspacom-web-wallet | PR 4c — multi-wallet management |
| 201 | kaspacom-web-wallet | PR 5a — nightly workflow + Telegram failure alert |
| 202 | kaspacom-web-wallet | iframe embed suite (covers #185) |
| 203 | kaspacom-web-wallet | PR 4c.1 — row-action + add-account dialog |
| 3 | KASPACOM/E2E-Tests | Mirror wallet into cross-repo nightly |

## Delivered

- **14 `@smoke` tests × 3 browser engines (chromium / webkit / firefox)** = 42 gating checks every PR on `develop`/`main`
- **1 `@funded` chain-verified test** — imports the org-secret seed, reads on-chain balance via TN10 explorer
- **Full suite** via `npm run e2e` (local) or `npm run e2e:all` (all four browsers)
- **Nightly at 02:00 UTC** across 4 browsers; on failure posts to Telegram topic `51073` via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_GROUP_ID`
- **Cross-repo mirror** in `KASPACOM/E2E-Tests` under the `wallet` project — hits `dev-wallet.kaspa.com`, asserts landing renders without console errors. Same board as `defi` / `kaspiano` / `api`

## Suite coverage

| File | Tests | Regressions it would have caught |
|------|-------|----------------------------------|
| `onboarding.spec.ts` | 10 (4 @smoke) | generic onboarding breakage |
| `funded-wallet.spec.ts` | 1 (@funded) | secret misconfiguration, wallet import failure |
| `settings.spec.ts` | 3 (@smoke) | export password gate, delete-phrase validator |
| `token-import.spec.ts` | 3 (@smoke) | #182 entry-point / validation |
| `multi-wallet.spec.ts` | 3 (@smoke) | per-row actions, add-account dialog |
| `iframe.spec.ts` | 2 (1 @smoke) | #185 iframe Safari/Firefox/mobile-100dvh |

## Deferred / known limitations

Documented in the `tasks.md` alongside this file:

- **Send tests (PR 2b-e)** blocked on [dual balance-signal architecture](../../../.claude/projects/-root/memory/reference_wallet_balance_signals.md). The UI reads `walletStateBalance` (WebSocket UtxoProcessor) while the HTTP `balanceSignal` updates independently. Until that investigation concludes, send tests can't reliably observe wallet balance post-import. Chain-API-as-truth is the interim workaround used in PR 2a.
- **Swap / approval tests** same dependency.
- **Mobile-safari stability** — `continue-on-error` in the CI matrix. WebKit stability checks time out inside the animated phone-frame panel. Synthetic-click fallback helps the landing test; deeper flows need a local debug session with a real iPhone 14 viewport (VPS is missing required system libs).

## Key gotchas (for future edits)

1. **Angular `[input]="..."` bindings don't reflect to DOM attributes.** `kc-button[text="..."]`, `kc-input[label="..."]`, `kc-icon[iconClass="..."]` all match nothing. Use `hasText`, `{ hasText: /.../}`, or a stable CSS class like `.settings-icon`.
2. **Import flow SUCCESS step doesn't auto-navigate.** Must click "Finish" — unlike the new-wallet ADDRESS step which navigates in `ngOnInit`.
3. **`ng serve` in this repo binds to `host: local.kaspa.com`** (angular.json). For CI, the Playwright webServer overrides via `--host 127.0.0.1 --disable-host-check`.
4. **BIP39 all-abandon test vector is rejected** by `@kaspacom/wallet-messages` — likely a well-known-seed guard. Fixture seeds are freshly generated valid mnemonics.
5. **Quick-action dialog host is `display: inline, height: 0`** (Angular portal pattern). Assert on the child `.quick-action-dialog-content`, not the `app-quick-action-dialog` element.
6. **Row-action icons** (`.wallet-item__export`, `.wallet-item__trash`) are `visibility: hidden` until `.wallet-item:hover` or `@media < 768px`. Use `toBeAttached()` for regression tests that don't want to simulate hover.
