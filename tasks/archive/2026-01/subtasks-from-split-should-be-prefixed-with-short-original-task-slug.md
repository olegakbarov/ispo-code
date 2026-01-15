# subtasks from split should be prefixed with short original task slug

## Problem Statement
When splitting a task into subtasks, the new filenames lose context of their parent. For example, splitting "implement-auth-system" into "UI", "API", "Tests" creates files like `ui.md`, `api.md`, `tests.md` - making it unclear what feature they belong to.

## Scope
**In:**
- Generate short prefix slug from original task title
- Prefix subtask filenames: `auth-ui.md` instead of `ui.md`
- Keep slug short (3-4 words max) to avoid unwieldy filenames

**Out:**
- Changing directory structure (no nested folders)
- UI changes to show hierarchy
- Modifying existing task filenames

## Plan

- [x] Define scope
  - ✓ Verified: Scope clearly defined above
- [x] Implement - modify splitTask to generate and use parent prefix
  - ✓ Verified: Implementation complete (see details below)
- [x] Validate
  - ✓ Verified: Build passes with no type errors

## Implementation Plan

### Phase: Backend Changes
- [x] Create `generateShortSlug(title)` helper in task-service.ts
  - Extract first 3 meaningful words from title (skipping stop words)
  - Slugify (lowercase, hyphenate)
  - ✓ Verified: Function at `task-service.ts:324-347` - correctly filters stop words, extracts first 3 words, returns slugified result
- [x] Modify `splitTask` mutation to:
  - Generate short slug from original task title
  - Pass prefix to `createTask` for each subtask
  - ✓ Verified: Changes at `tasks.ts:717-754` - correctly calls `generateShortSlug(task.title)` and passes `prefix` to `createTask`
- [x] Update `createTask` to accept optional `prefix` param
  - Filename becomes: `{prefix}-{section-slug}.md`
  - ✓ Verified: Changes at `task-service.ts:349-375` - accepts `prefix?: string` in params, constructs `fullSlug = prefix ? \`${prefix}-${slugBase}\` : slugBase`

## Key Files (Updated)
- `src/lib/agent/task-service.ts:324-347` - new `generateShortSlug()` function
- `src/lib/agent/task-service.ts:349-375` - `createTask()` with prefix support  
- `src/trpc/tasks.ts:717-754` - splitTask using prefix

## Validation
- Build passes: `npm run build` ✓
  - ✓ Verified: Build completed successfully with no errors
- No type errors introduced in modified files
  - ✓ Verified: TypeScript compilation passed

## Verification Results

| Item | Status | Notes |
|------|--------|-------|
| `generateShortSlug` helper | ✅ Complete | Implemented at lines 324-347 (task doc said 315-338 - minor drift) |
| `splitTask` prefix usage | ✅ Complete | Line 718 generates prefix, line 752 passes to createTask |
| `createTask` prefix param | ✅ Complete | Implemented at lines 349-375 with proper prefix handling |
| Build passes | ✅ Verified | `npm run build` completed successfully |
| Import/export chain | ✅ Verified | generateShortSlug exported from task-service.ts, imported in tasks.ts |

**Overall: All items verified complete.** Minor discrepancy: line numbers in documentation are slightly off due to code changes since documentation was written (off by ~9 lines). This is cosmetic and doesn't affect functionality.