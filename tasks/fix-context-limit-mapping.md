# Fix Context Limit Mapping for Metadata

## Problem Statement
Metadata context limits are hardcoded to values that do not match Cerebras model context windows, making utilization percentages inaccurate.

## Scope
- In scope: use model-specific context limits and propagate model limits to MetadataAnalyzer.
- Out of scope: real tokenizer-based accounting.

## Implementation Plan
- [x] Map Cerebras models to their actual context limits and pass the limit into `MetadataAnalyzer`.
- [x] For OpenCode, use the selected model when available.
- [x] Ensure unknown models fall back to a sensible default.

## Key Files
- `src/lib/agent/metadata-analyzer.ts`
- `src/lib/agent/cerebras.ts`
- `src/lib/agent/config.ts`
- `src/lib/agent/manager.ts`
- `src/daemon/agent-daemon.ts`

## Testing
- [ ] Run a Cerebras session and verify utilization percent aligns with 131k context limits.

## Success Criteria
- [ ] Context utilization is consistent with the selected model limits.

## Implementation Notes
The fix involved:
1. Importing `getContextLimit` from `model-registry.ts` in both `manager.ts` and `agent-daemon.ts`
2. Passing the model-specific context limit to `MetadataAnalyzer` constructor
3. Updating fallback defaults in both `metadata-analyzer.ts` and `model-registry.ts`:
   - Cerebras: 8,192 → 131,072 (matches actual GLM-4.7 context window)
   - Codex: 128,000 → 200,000 (matches Codex 5.2 context window)
