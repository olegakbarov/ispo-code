# audio notification should be 2x longer for task name

## Plan

- [x] Define scope
- [x] Implement
- [x] Validate

## Summary

Changed `getTaskSnippet()` from 5 words to 10 words (2x longer) in `src/lib/utils/task-title.ts:59`.

Audio notifications will now say more of the task title, e.g.:
- Before: "Task completed successfully: audio notification should specify which"
- After: "Task completed successfully: audio notification should specify which task has been completed failed"
