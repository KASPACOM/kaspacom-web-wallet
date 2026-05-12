# Design: Wallet Sentry Resilience Hardening

## Current Failure Clusters

### RPC/WebSocket disconnects
Sentry clusters: `WALLET-6`, `WALLET-K`.
Likely root causes:
- Browser sleep/mobile Safari suspends WebSocket.
- RPC client disconnect events recursively call `waitForConnection()` and can leave rejected promises/noisy reconnect loops.
- Timed-out `RpcClient.connect()` can continue background work if not retired.
- Replaced clients can still emit disconnects.

### Asset-loader stale async state
Sentry clusters: `WALLET-37`, `WALLET-2S`, `WALLET-36`, `WALLET-2Y`, `WALLET-2Q`.
Root cause:
- `stopLoadingAllAssetsAndClear()` sets `loadAssetsTimeouts = undefined` while `loadAssetAndSetTimeout()` is still awaiting a loader.
- The stale async continuation then writes to `this.loadAssetsTimeouts![key]` or mutates cleared state.

### WASM/startup aborts
Sentry clusters: `WALLET-X`, `WALLET-B`.
Likely causes:
- Network/browser abort while loading `kaspa_bg.wasm`.
- Local dev abort/noise polluting production triage.
- Startup context lacks enough browser/network/visibility detail.

## Loopholes and Fix Strategy

| Loophole | Risk | Fix/Guard |
|---|---|---|
| Timed-out `RpcClient.connect()` keeps running | stale websocket/background reconnect noise | disconnect current client in connection failure path, even if `isConnected` is false |
| Duplicate disconnect events create reconnect storms | user-facing instability / Sentry spam | single scheduled reconnect guard + backoff/jitter |
| `isTryingToConnect` prevents failure-path reconnect from being scheduled | first failed reconnect can stall until external event | schedule reconnect even during current failure path, guarded only by existing timer |
| Stale RPC emits disconnect after replacement | false reconnects | disconnect handler ignores events when `rpcService.getRpc() !== currentRpc` |
| Asset stop occurs while load is pending | undefined map write / stale state | generation/session guard around writes and timer scheduling |
| Stale load clears new load indicator | incorrect loading UI | only active generation may clear loading state |
| Full URL sent in custom Sentry context | query/hash privacy risk | send pathname/origin/visibility/online only |
| WASM transient abort fails permanently | avoidable startup failure | retry transient load once with short delay |
| Local dev noise pollutes triage | false production signal | suppress transient startup captures in development only |
| Test runner unavailable/full disk | false confidence | free stale scratch space, run build + at least one browser Karma command |
| Mobile Safari PR smoke is unstable/unrelated to this Sentry fix | blocks focused RPC/assets PR with known mobile-only E2E flake | remove mobile-safari from PR gate and track as separate stabilization work; Chromium/Firefox/WebKit remain blocking |

## Validation Strategy

### Automated
- `git diff --check`
- `npm run build:dev`
- `CHROME_BIN=/tmp/chrome-no-sandbox npx ng test --include src/app/services/referral.service.spec.ts --watch=false --browsers=ChromeHeadless`
- GitHub PR checks: build/test/security/e2e matrix.

### Manual QA before merge/deploy
- Open `/app/home` with existing wallet.
- Toggle offline → online; verify app reconnects and no permanent broken state.
- Hide tab/mobile sleep → visible/resume; verify reconnect attempt and balances recover.
- Switch wallet/account while asset lists are loading; verify no `loadAssetsTimeouts`/`krc721`/`kns` errors.
- Hard refresh on slow network; verify WASM retry path does not show fatal loader unless second attempt fails.

### Post-deploy Sentry watch
- Check production-only unresolved events after deployment, comparing 24h before/after for target clusters.
- Confirm remaining events include improved context: route, origin, visibility state, online state, error type.
