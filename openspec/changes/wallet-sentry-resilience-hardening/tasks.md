# Tasks

## Implementation
- [x] Add generation/session guard to `BaseAssetsStoreService`.
- [x] Make stopped `reloadAllAssets()` / `reloadAsset()` safe no-ops.
- [x] Add old RPC best-effort disconnect on `RpcService.refreshRpc()`.
- [x] Replace recursive reconnect flow in `KaspaNetworkConnectionManagerService`.
- [x] Add online/visibility resume reconnect triggers.
- [x] Retire/disconnect timed-out/replaced RPC clients.
- [x] Add WASM transient retry-once during startup.
- [x] Reduce development Sentry noise for transient startup aborts.
- [x] Avoid full query/hash URL in custom Sentry startup context.
- [x] Escape startup error details before HTML injection.

## Review Loop
- [x] Run local build.
- [x] Run browser-based test sanity command.
- [x] Run cross-model review.
- [x] Fix MAJOR stale timed-out RPC client finding.
- [ ] Wait for all GitHub checks to complete.
- [ ] If any GitHub check fails, diagnose/fix once and rerun.
- [ ] If same gate fails again, escalate with exact error.

## Manual QA
- [ ] `/app/home` offline → online recovery.
- [ ] `/app/home` tab hidden/mobile sleep → visible recovery.
- [ ] Wallet/account switch while asset lists are loading.
- [ ] Slow/aborted WASM startup path.

## Post-deploy Monitoring
- [ ] Compare production Sentry clusters after deploy: `WALLET-6`, `WALLET-K`, `WALLET-37`, `WALLET-2S`, `WALLET-36`, `WALLET-2Y`, `WALLET-2Q`, `WALLET-X`, `WALLET-B`.
- [ ] Decide follow-up if RPC errors persist: central `withRpcConnectionRetry()` wrapper around individual Kaspa operations.
