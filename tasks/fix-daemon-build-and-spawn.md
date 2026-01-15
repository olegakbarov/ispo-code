# Fix Daemon Build and Spawn in Production

## Problem Statement
Production mode expects `dist/daemon/agent-daemon.js`, but the build does not produce this file, so spawning daemons fails outside dev.

## Scope
- In scope: make daemon scripts available in production and align spawn logic with build output.
- Out of scope: re-architecting process spawning.

## Implementation Plan
- [ ] Add a build step to compile `src/daemon/agent-daemon.ts` into `dist/daemon/agent-daemon.js`.
- [ ] Update `package.json` scripts or add a separate build tool (tsup, tsx, or tsc) for daemon output.
- [ ] Ensure `ProcessMonitor` uses the correct path for dev and prod.
- [ ] Document the build requirement for daemon usage.

## Key Files
- `package.json`
- `src/daemon/process-monitor.ts`
- `src/daemon/agent-daemon.ts`

## Testing
- [ ] Run `npm run build` and verify `dist/daemon/agent-daemon.js` exists.
- [ ] Run production start and spawn a daemon successfully.

## Success Criteria
- [ ] Daemons spawn and run in production mode.
