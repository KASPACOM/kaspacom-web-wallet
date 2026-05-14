# Wallet E2E Tests

Playwright E2E suite for `kaspacom-web-wallet`. Part of the
[wallet-e2e-tests](../openspec/archive/wallet-e2e-tests/proposal.md) change.

## Running locally

```bash
npm install
npm run e2e:install          # installs chromium, webkit, firefox (with deps)
npm run e2e                  # full suite, all browsers (~10 min)
npm run e2e:smoke            # @smoke on Chromium only (fastest)
npm run e2e:smoke:all        # @smoke across all 4 projects
npm run e2e:funded           # funded-wallet tests (needs KASPA_E2E_SEED)
npm run e2e:webkit           # Safari (WebKit) project only
npm run e2e:firefox          # Firefox project only
npm run e2e:mobile           # iPhone 14 viewport project only
npm run e2e -- --ui          # Playwright UI mode
```

The dev server is started automatically via `webServer` in `playwright.config.ts`.
To run against an already-running server, set `E2E_SKIP_SERVER=1` and
`E2E_BASE_URL=http://127.0.0.1:4200`. The default base URL uses `127.0.0.1`
(not `localhost`) to avoid IPv6 `::1` / IPv4 mismatches with the Angular
dev server, which binds to IPv4 only — see `playwright.config.ts`.

## Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `E2E_PORT` | Port for auto-started dev server | `4200` |
| `E2E_BASE_URL` | Override base URL | `http://127.0.0.1:<E2E_PORT>` |
| `E2E_SKIP_SERVER` | Skip auto-starting the dev server | unset |
| `KASPA_E2E_SEED` | Pre-funded testnet seed for funded-wallet tests | unset |

Secrets go in `.env.e2e` at repo root (gitignored).

## Scope

Current suite covers onboarding (create, import, login, lock), settings,
iframe communication, ERC-20 token import, multi-wallet management, and
funded-wallet send/swap flows. See the [tasks list](../openspec/archive/wallet-e2e-tests/tasks.md)
for the breakdown.

## CI

GitHub Actions runs `@smoke`-tagged tests on every PR to `develop` / `main`
(job: `e2e-smoke` in `.github/workflows/pr-check.yml`). Full suite runs nightly
(separate workflow — added in PR 2).

Failure artifacts (traces, videos, screenshots) are uploaded to the workflow
run's artifacts on failure.

## Conventions

- **No flaky retries.** Retries in CI are 1 only; if a test is genuinely flaky,
  fix the race, don't paper over it.
- **`fullyParallel: false`** — tests share localStorage / IndexedDB and cannot
  run in parallel in the same browser. Parallelism comes from CI sharding, not
  from concurrent workers.
- **Selector priority:** `formControlName` / `role` > `kc-button[text]` > class.
  Avoid querying text content that may be copy-edited (headings, descriptions).
- **`@smoke` tag:** mark the 5–8 fastest, most critical tests. CI PR gate runs
  only these; full suite runs nightly.

## Adding a test

1. Put a `.spec.ts` file under `e2e/` named after the feature.
2. Import helpers from `e2e/helpers/*` and fixtures from `e2e/fixtures/*`.
3. Start each test with `await clearWalletState(page)` in `beforeEach`.
4. Tag the 1–2 highest-signal cases with `@smoke`.
