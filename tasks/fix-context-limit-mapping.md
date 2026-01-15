# Fix Context Limit Mapping for Metadata

## Problem Statement
Metadata context limits are hardcoded to values that do not match Cerebras model context windows, making utilization percentages inaccurate.

## Scope
- In scope: use model-specific context limits and propagate model limits to MetadataAnalyzer.
- Out of scope: real tokenizer-based accounting.

## Implementation Plan
- [ ] Map Cerebras models to their actual context limits and pass the limit into `MetadataAnalyzer`.
- [ ] For OpenCode, use the selected model when available.
- [ ] Ensure unknown models fall back to a sensible default.

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
