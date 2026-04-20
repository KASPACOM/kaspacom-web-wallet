# Design

## Location: in-repo vs central E2E-Tests

**Decision: in-repo `e2e/` folder.**

| Option | Pros | Cons |
|--------|------|------|
| In-repo (chosen) | PR-gated, no cross-repo coordination, tests land with the feature | Duplicates some infra vs central repo |
| Central `E2E-Tests` | One Playwright install, unified nightly | Can't block a wallet PR; slow feedback loop; requires coordinating two PRs for every change |

The wallet ships independently, has its own CI, and its failure modes are regressions in its own code. Gating on PR is the point — that's what would have caught #191, #185, #182. We can still mirror `@smoke` into the central repo for the cross-repo nightly.

## Environment: testnet vs mocks

**Decision: live testnet (TN10 + Kasplex/IGRA testnet), pre-funded fixture wallet.**

Mocking the 6+ upstream APIs (Kaspa RPC, KaspaCom API, DeFi API, Kasplex, KNS, KRC721) would require 500+ lines of fixture JSON per test and would miss real breakage (e.g. PR #189's missing RPC URL — a mock would have been configured correctly and the test would have passed).

Onboarding tests need **no network** — they exercise local state only. Send/swap/approval tests need a funded wallet. We inject the seed via `KASPA_E2E_SEED` GitHub secret at CI time; locally, developers use their own via `.env.e2e`.

## Storage seeding strategy

The wallet uses `localStorage.userData` (AES-encrypted) + Dexie for UTXO cache. For tests that skip onboarding (send, swap, etc.), we pre-encrypt `userData` in a helper and `page.evaluate(() => localStorage.setItem(...))` before navigation. Dexie cache regenerates on first load.

## data-testid attributes

The current DOM has zero `data-testid`. Selectors like `kc-button:has-text("Continue")` work but break on copy edits. We add `data-testid` to ~15 interactive elements touched by onboarding tests. No visual or behavioral change. Follow-up suites add more testids as they go; the convention is `data-testid="<feature>-<element>"` (e.g. `onboarding-create-btn`, `seed-word-input-0`).

## SSR hydration handling

Angular SSR with 600ms step transitions requires: `waitForFunction(() => !document.querySelector('[class*="transitioning"]'))` between steps. Helpers encapsulate this so individual tests stay readable.

## Scope creep guardrails

- No retry logic for flaky network — we fix flakes, not paper over them
- No parallel test execution across files (shared localStorage conflicts) — Playwright `fullyParallel: false` per project
- No visual regression (Percy/Chromatic) in this change — add later if needed
- No mobile device emulation beyond one viewport (PR 3 covers mobile for iframe)
