# KCW contracts ticket updates

Copy these into KCW-77 through KCW-84. They are written as ticket body updates or implementation comments.

## KCW-77 - My Contracts dashboard

Build the default full-screen `/app/contracts` view as an indexer-backed My Contracts dashboard for wallet covenant tracking.

Acceptance criteria:

- Dashboard loads contracts involving the current wallet from `GET /covenants?wallet={addressOrPubkey}&active={bool}&sort=recent&limit={n}`.
- Wallet lookup checks both wallet address and x-only pubkey where available.
- Role/template filters use `walletArg`, `template`, and `active` query params.
- Supported v1 templates are Deadman Switch, Time Lock, MultiSig, and Escrow.
- Each card shows contract type, status, locked amount, participants/roles, deadline or unlock time, latest tx/action, and next available action.
- Local registry entries are merged only as fallback/cache while indexer data catches up.
- If indexer is unavailable, show local cached entries with an indexer-unavailable message.
- Raw IDs, args, outpoints, and JSON stay hidden under Advanced or detail views.

Indexer dependencies:

- `GET /covenants?wallet={wallet}`
- `GET /covenants?wallet={wallet}&walletArg={role}`
- `GET /covenants?wallet={wallet}&template={template}&active={bool}`

## KCW-78 - Guided deployment wizard

Build a guided create flow for the four v1 wallet covenant templates.

Acceptance criteria:

- User chooses one of: Deadman Switch, Time Lock, MultiSig, Escrow.
- Forms use wallet-friendly field names, address/account picker where possible, date-time inputs instead of raw timestamps, and validation before deploy.
- Review screen explains amount locked, parties, unlock/expiry/deadline, allowed actions, fees, and risk summary before wallet approval.
- After wallet approval, show txid immediately.
- After deploy, poll `GET /tx/{txid}/settlement-status`.
- When indexed, show canonical `covenantIdHex` and enable share link.
- If not indexed yet, show waiting/indexer-pending state and keep local registry fallback.

Indexer dependencies:

- `GET /tx/{txid}/settlement-status`
- `GET /tx/{txid}`
- `GET /covenants/by-id/{covenant_id}` after canonical ID is known

## KCW-79 - User education, tooltips, validator explanations

Make covenant templates understandable to normal wallet users without exposing raw covenant internals by default.

Acceptance criteria:

- Each template explains what it does, when to use it, involved roles, parameters, next actions, and risks.
- Deadman explains owner, heir, check-in deadline, keep alive, claim, and continuation.
- Time Lock explains signer, recovery wallet, unlock time, withdraw, and recover.
- MultiSig explains signers, threshold behavior, partial signing, and completion.
- Escrow explains buyer, seller, arbiter, release, refund, and arbitrate.
- Confidence/state copy uses indexer fields where available: `constructor`, `claimedArgs`, `decodedArgs`, `classificationStatus`, `classificationKind`, and `claimVerified`.
- If claim/template confidence is weak or missing, UI labels the contract as tracking incomplete or unverified.
- Advanced drawer contains raw covenant ID, script hash, outpoint, args, and JSON.

## KCW-80 - Share/import flow for created contracts

Build a share/import flow that lets another wallet open and track a covenant using public indexer data only.

Acceptance criteria:

- Share link format: `/app/contracts?network={network}&contract={canonicalCovenantId}`.
- Share link must not include private data, compiled JSON secrets, or local-only wallet state.
- Receiving wallet reads `network` and `contract` query params.
- If network is supported, wallet switches/loads that network and previews the contract.
- If contract is already tracked, open existing detail instead of creating a duplicate local registry entry.
- Import accepts covenant ID, script hash, txid, covenant address, or concrete search result.
- Direct ID lookups prefer `GET /covenants/by-id/{covenant_id}` and fall back to `GET /covenants/{idOrScriptHash}`.
- Tx import uses `GET /tx/{txid}`.
- Address/fuzzy import uses `GET /covenants?q={query}` first and `GET /explorer/search?q={query}` for concrete covenant/tx results.
- Template/category search results are not importable by themselves.

Indexer dependencies:

- `GET /covenants/by-id/{covenant_id}`
- `GET /covenants/{idOrScriptHash}`
- `GET /tx/{txid}`
- `GET /covenants?q={query}`
- `GET /explorer/search?q={query}`

## KCW-81 - Contract detail page with current state and timeline

Build the contract detail page as the canonical tracking screen for current covenant lifecycle state.

Acceptance criteria:

- Detail loads contract summary from `GET /covenants/{idOrScriptHash}` or `GET /covenants/by-id/{covenant_id}`.
- Detail loads history from `GET /covenants/{idOrScriptHash}/actions`.
- Detail loads current spendable UTXOs from `GET /covenants/{idOrScriptHash}/utxos`.
- Header shows type, status, locked amount, and latest action.
- Participants are displayed as role labels, not raw args.
- State area shows active UTXO, current continuation, current address, deadline/unlock, and latest tx.
- Timeline shows deploy/spend/continuation actions.
- Current state must come from latest active UTXO/action, not only original deploy params.
- If latest continuation or current UTXO cannot be determined, show tracking incomplete and disable unsafe actions.
- Advanced drawer shows covenant ID, script hash, outpoint, raw args, and JSON.

## KCW-82 - Replace generic Interact with role-based action buttons

Normal users should see safe contextual contract actions, not the generic ABI/manual interact flow.

Acceptance criteria:

- Deadman actions: Keep Alive, Claim.
- Time Lock actions: Withdraw, Recover.
- MultiSig actions: Create Partial, Sign, Complete.
- Escrow actions: Release, Refund, Arbitrate.
- Enabled/disabled state is computed from current wallet role, active UTXO, deadline/unlock state, and latest indexer state.
- If current state is missing or tracking incomplete, disable unsafe spend actions and explain why.
- Action review/approval summary is human-readable and includes amount, recipient/role, condition, tx fee/risk where relevant.
- Manual JSON/ABI interaction remains available only under Advanced/dev mode.

Indexer dependencies:

- `GET /covenants/{id}/utxos`
- `GET /covenants/{id}/actions`
- current role/participant fields from covenant summary

## KCW-83 - Indexer data required for wallet contract tracking

Treat indexer-backed covenant data as a foundational wallet dependency.

Acceptance criteria:

- Confirm wallet participant search works with wallet address and x-only pubkey.
- Confirm role filters work with `walletArg` values: owner, heir, buyer, seller, arbiter, key1, key2, key3, signer/recovery where applicable.
- Confirm canonical ID lookup and script hash lookup behavior.
- Confirm tx settlement path after deploy.
- Confirm latest active continuation/current UTXO/deadline can be derived cleanly for Deadman keep-alive.
- UI must expose tracking incomplete state if latest continuation, deadline, active UTXO, or user role cannot be determined.
- Unsafe action buttons must be disabled when tracking is incomplete.

Required endpoints:

- `GET /covenants?wallet={wallet}&walletArg={role}&template={template}&active={bool}`
- `GET /covenants/{id}/actions`
- `GET /covenants/{id}/utxos`
- `GET /tx/{txid}/settlement-status`
- `GET /tx/{txid}`
- `GET /covenants?q={query}`
- `GET /explorer/search?q={query}`

## KCW-84 - End-to-end covenant UX QA scenarios

Test the full user lifecycle across the four supported v1 templates.

Acceptance criteria:

- Deadman: deploy -> indexer appears -> keep alive -> detail shows new deadline/latest continuation.
- Deadman: import by canonical covenant ID -> same latest state appears.
- Time Lock: before unlock, withdraw is disabled and recover state is clear.
- Time Lock: after unlock, correct withdraw/recover action is enabled for the correct role.
- MultiSig: signer A creates partial -> signer B imports/signs/completes -> timeline updates.
- Escrow: buyer/seller/arbiter see only the actions available to their role.
- Share link opened in a fresh wallet/session previews or opens the correct contract without duplicate registry entries.
- Wallet approval modal uses human-readable action summaries, not raw JSON/outpoints.
- Indexer unavailable and tracking incomplete states are tested.

Regression checks:

- Local-only deployments still appear while waiting for indexer.
- Unsupported templates fail import with clear copy.
- Already-imported contracts do not duplicate.
- Advanced/dev manual interact remains available for developers.
