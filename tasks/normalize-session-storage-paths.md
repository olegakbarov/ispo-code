# Normalize Session and Daemon Storage Paths

## Problem Statement
Session store and daemon registry write to module-relative `src/data` or `dist/data`, leaving runtime data inside the source tree and ignoring the repo root `data/` convention.

## Scope
- In scope: unify storage paths under a single configurable root (default to repo root `data/`).
- Out of scope: migrating existing data across machines.

## Implementation Plan
- [ ] Introduce a shared data-dir resolver (env var plus default).
- [ ] Update session store and daemon registry to use the resolved path.
- [ ] Add a simple migration or warning if old data is detected.
- [ ] Verify `.gitignore` covers the new location.

## Key Files
- `src/lib/agent/session-store.ts`
- `src/daemon/daemon-registry.ts`
- `.gitignore`

## Testing
- [ ] Start server; confirm new sessions appear under root `data/`.
- [ ] Ensure no new `src/data` or `dist/data` directories are created.

## Success Criteria
- [ ] Runtime data is stored under the configured root directory.
