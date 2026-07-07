# Contracts indexer product plan

This is the handoff for refining KCW-77 through KCW-84 and briefing Claude Design. The product goal is not more covenant mechanics first; it is the data foundation and user flows that make existing v1 covenant templates usable in the wallet.

## Source of truth

Use the covenant indexer as the source of truth for contract lifecycle state. Local registry data is only a cache/fallback while the indexer catches up.

Configured indexers:

- Mainnet: `https://indexer.kaspa.com`
- TN10: `https://tn10-indexer.kaspa.com`

Primary endpoints:

- `GET /covenants?wallet={addressOrPubkey}&active={bool}&sort=recent&limit={n}`
- `GET /covenants?wallet={wallet}&walletArg={role}&template={template}`
- `GET /covenants?q={query}` for broad import fallback, including covenant addresses
- `GET /covenants/{idOrScriptHash}`
- `GET /covenants/by-id/{covenant_id}`
- `GET /covenants/{idOrScriptHash}/actions`
- `GET /covenants/{idOrScriptHash}/utxos`
- `GET /tx/{txid}`
- `GET /tx/{txid}/settlement-status`
- `GET /explorer/search?q={query}`

Important implementation rule: prefer `/covenants?wallet=...` over `/addresses/{address}/covenants` for My Contracts, because wallet matching must include participant args and decoded constructor args, not only covenant P2SH addresses.

## Jira refinements

KCW-77, My Contracts dashboard:

- Default full-screen view is My Contracts.
- Fetch My Contracts with `/covenants?wallet=...&sort=recent&limit=...` and filter supported wallet templates client-side.
- Do not require `classification=covenant` for My Contracts because fresh wallet-created templates can be indexed as `unknown/unrevealed` while still exposing `claimedTemplate` and `claimedArgs`.
- Support optional filters by template, active state, classification state, and role via `walletArg`.
- Cards show type, status, locked KAS, participants, deadline/unlock, latest tx/action, and next action.
- Local registry entries remain visible only as fallback/cache.

KCW-78, Guided deployment wizard:

- V1 templates: Deadman Switch, Time Lock, MultiSig, Escrow.
- Use friendly forms, address/account pickers, date-time inputs, validation, and final review.
- After deploy, poll `/tx/{txid}/settlement-status`.
- Once indexed, expose canonical `covenantIdHex` for share/import.

KCW-79, Education/tooltips:

- Explain template purpose, roles, parameters, possible actions, and risks.
- Use `constructor`, `claimedArgs`, `decodedArgs`, `classificationStatus`, and `claimVerified` to explain state confidence.
- Put raw IDs, outpoints, args, and JSON under Advanced.

KCW-80, Share/import:

- Share links carry only `network` and canonical covenant ID.
- Import accepts covenant ID, script hash, txid, covenant address, or concrete search result.
- Use direct covenant lookup first, tx lookup second, `/covenants?q=` for addresses, and `/explorer/search` for concrete ID discovery.
- If already tracked, open the existing detail instead of duplicating local registry state.

KCW-81, Contract detail:

- Detail is the canonical tracking screen.
- Load summary/timeline from `/covenants/{id}` or `/covenants/by-id/{id}`.
- Load active spendable UTXOs from `/covenants/{id}/utxos`.
- Load history from `/covenants/{id}/actions`.
- Show current active continuation/deadline from latest indexed state, not only original deploy params.

KCW-82, Role-based actions:

- Normal mode uses contextual actions, not generic Interact.
- Deadman: Keep Alive, Claim.
- Time Lock: Withdraw, Recover.
- MultiSig: Create Partial, Sign, Complete.
- Escrow: Release, Refund, Arbitrate.
- Enabled state comes from wallet role, active UTXO, deadline/unlock, and latest indexer state.
- Manual JSON/ABI interaction remains Advanced/dev mode only.

KCW-83, Indexer dependency:

- Treat as foundational for wallet contract tracking.
- Required fields: template, canonical covenant ID, script hash, active UTXO/outpoint, locked amount, roles/participants, latest tx/action, action timeline, latest continuation/current state, deadline/unlock, and confidence fields.
- If latest continuation, current UTXO, role, or deadline cannot be determined, UI must show tracking incomplete and disable unsafe actions.

KCW-84, E2E QA:

- Deadman deploy -> indexed -> keep alive -> detail shows new deadline/latest continuation.
- Import Deadman by covenant ID -> same latest state appears.
- Time Lock shows locked/unlocked and withdraw/recover state correctly.
- MultiSig signer A creates partial -> signer B imports/signs/completes.
- Escrow release/refund/arbitrate buttons match role and status.
- Approval modal shows human-readable summary, not raw JSON/outpoints.

## Claude Design brief

Design the full-screen `/app/contracts` workspace using the current wallet design system. The compact wallet UI is only an entry point into this workspace.

Required product areas:

- My Contracts dashboard
- Create wizard
- Import/share flow
- Contract detail
- Timeline/history
- Role-based action panel
- Approval-summary content
- Advanced technical drawer
- Empty/loading/error/indexer-unavailable/tracking-incomplete states

Design around normal wallet users. They need to understand what they created, who is involved, what funds are locked, what can happen next, and what action they can safely take. Raw covenant IDs, outpoints, args, and JSON should be accessible but hidden by default.
