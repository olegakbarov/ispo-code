# QA agent is not available

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: QA Agent (mcporter) is reported as unavailable in the UI even when a custom MCPorter config path is provided.
- **Immediate Cause**: `getAvailableAgentTypes()` omits `mcporter` because `checkMCPorterConfig()` only checks default config locations and ignores `MCPORTER_CONFIG_PATH` / test-mode paths.
- **Call Chain**: UI agent selectors → `trpc.agent.availableTypes` → `getAvailableAgentTypes()` in `src/lib/agent/cli-runner.ts` → `checkMCPorterConfig()` → config path not found → `mcporter` excluded → UI shows unavailable/disabled.
- **Original Trigger**: Config override support was added in `mcp-server-validator.ts` (`MCPORTER_CONFIG_PATH`, `MCPORTER_TEST_MODE`) but the availability check in `cli-runner.ts` was not updated to use the same resolution logic.
- **Evidence**:
  - `src/lib/agent/cli-runner.ts` only checks `~/.mcporter/mcporter.json`, `~/.config/mcporter/mcporter.json`, and Claude Desktop config.
  - `src/lib/agent/mcp-server-validator.ts` supports `MCPORTER_CONFIG_PATH` and `MCPORTER_TEST_MODE` via `getConfigPaths()` / `loadAndValidateConfigs()`.
  - `tasks/archive/2026-01/test-environment-configuration.md` documents the override path behavior.

### Phase 2: Pattern Analysis
- **Working Examples**:
  - `loadAndValidateConfigs()` respects `MCPORTER_CONFIG_PATH` and test-mode paths before falling back to defaults.
  - UI components (task creation, settings) already list all agent candidates and mark unavailable ones.
- **Key Differences**:
  - Availability check in `cli-runner.ts` uses hard-coded paths and ignores environment overrides.
  - Validation logic in `mcp-server-validator.ts` uses a broader, documented resolution order.
- **Dependencies**:
  - `MCPORTER_CONFIG_PATH`, `MCPORTER_TEST_MODE`
  - Gemini API key (`GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`)
  - MCPorter config file containing `servers` or `mcpServers`

### Phase 3: Hypothesis & Testing
- **Hypothesis**: QA agent is marked unavailable because `checkMCPorterConfig()` ignores `MCPORTER_CONFIG_PATH`; when HOME is pointed to an empty temp dir and the override path is set, `getAvailableAgentTypes()` should still include `mcporter` after the fix.
- **Test Design**: Add `cli-runner.test.ts` that:
  1. Creates a temp MCPorter config with a mock server.
  2. Sets `MCPORTER_CONFIG_PATH` to that file and `GEMINI_API_KEY` to a dummy value.
  3. Sets `HOME` to a temp directory with no configs.
  4. Calls `getAvailableAgentTypes()` and asserts `mcporter` is included.
- **Prediction**: Before the fix, the test fails (mcporter missing); after the fix, it passes.
- **Result**: Test failed before the fix (`getAvailableAgentTypes()` returned `[ 'codex', 'opencode', … ]` without `mcporter`).
- **Conclusion**: Hypothesis confirmed; availability check is not honoring config path overrides.

### Phase 4: Implementation
- **Root Cause**: Availability logic in `cli-runner.ts` (and sync check in `mcporter.ts`) ignored `MCPORTER_CONFIG_PATH` / test-mode paths, so mcporter stayed unavailable when config was provided via override.
- **Solution**: Use the same config resolution logic as the validator:
  - Prefer `MCPORTER_CONFIG_PATH` when set.
  - Fall back to `getConfigPaths()` (includes test-mode and default locations).
- **Test Case**: `src/lib/agent/__tests__/cli-runner.test.ts` sets temp `HOME`, `MCPORTER_CONFIG_PATH`, and `GEMINI_API_KEY`, then asserts `getAvailableAgentTypes()` includes `mcporter`.
- **Verification**: `npx vitest run src/lib/agent/__tests__/cli-runner.test.ts`
- **Changes Made**:
  - `src/lib/agent/cli-runner.ts` - honor `MCPORTER_CONFIG_PATH` / `getConfigPaths()` in availability check.
  - `src/lib/agent/mcporter.ts` - align sync availability check with override-aware paths.
  - `src/lib/agent/__tests__/cli-runner.test.ts` - coverage for override-based availability.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
