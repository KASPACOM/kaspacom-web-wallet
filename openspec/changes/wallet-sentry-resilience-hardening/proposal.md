# Wallet Sentry Resilience Hardening

## Why
Production Sentry shows high-volume wallet failures around Kaspa RPC/WebSocket lifecycle, asset-loader async races, and WASM/startup aborts. PR #209 introduces defensive fixes, but production wallet reliability requires a structured loophole pass before merge.

## Goals
- Reduce/stop production Sentry clusters `WALLET-6`, `WALLET-K`, `WALLET-37`, `WALLET-2S`, `WALLET-36`, `WALLET-2Y`, `WALLET-2Q`, `WALLET-X`, and `WALLET-B`.
- Prevent stale async asset loaders from mutating state or scheduling timers after stop/restart.
- Prevent timed-out/replaced Kaspa RPC clients from keeping stale WebSocket/background reconnect work alive.
- Make startup/WASM failure telemetry more actionable without leaking full query/hash URLs.

## Non-goals
- No wallet architecture rewrite.
- No Kaspa WASM SDK replacement.
- No production deployment from this change alone.
- No broad UI changes.

## Success Criteria
- GitHub build/test/security checks pass on PR #209.
- Local build passes.
- At least one browser-based Karma test command proves the runner works in this environment.
- Cross-model review has no unresolved `CRITICAL` or `MAJOR` findings.
- Manual QA checklist is explicit for offline/online, tab resume, RPC reconnect, and wallet/account switch during asset loading.
- Post-deploy Sentry validation window is defined.
