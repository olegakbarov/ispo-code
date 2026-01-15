# Integrate Error Tracking

**Priority**: Medium
**Category**: Error Handling

## Problem

Errors logged to console but not to error tracking service:

```tsx
// src/components/tasks/task-review-panel.tsx (line 297)
catch (error) {
  console.error("Failed to generate commit message:", error)
}

// src/components/tasks/review-modal.tsx (line 66)
catch (error) {
  console.error("Review mutation failed:", error)
}

// src/components/agents/file-comment-input.tsx (line 107)
catch (error) {
  console.error("Comment submission failed:", error)
}
```

## Locations

- `src/components/tasks/task-review-panel.tsx` (line 297)
- `src/components/tasks/review-modal.tsx` (line 66)
- `src/components/agents/file-comment-input.tsx` (line 107)
- `src/components/agents/inline-diff-viewer.tsx` (error parsing)

## Fix Options

### Option 1: Custom Error Logger
```tsx
// src/lib/utils/error-tracking.ts
export function logError(error: unknown, context?: Record<string, unknown>) {
  console.error(error, context)

  // Future: Send to Sentry/LogRocket
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error, { extra: context })
  // }
}
```

### Option 2: tRPC Error Handler
Configure global error handler in tRPC client for mutation errors.

## Also Fix

Incomplete error boundaries - only text chunks wrapped in `SimpleErrorBoundary`. Extend to all output rendering in `output-renderer.tsx`:

```tsx
<SimpleErrorBoundary fallback={<FailedRender chunk={chunk} />}>
  {renderChunk(group)}
</SimpleErrorBoundary>
```
