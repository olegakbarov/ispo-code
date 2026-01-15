# Add Runtime Type Validation

**Priority**: Medium
**Category**: Type Safety

## Problem

Unsafe type assertions without runtime validation:

```tsx
// src/components/agents/output-renderer.tsx (lines 102-103)
const imageAttachments = chunk.attachments as ImageAttachment[] | undefined
```

## Risk

If `attachments` is not actually `ImageAttachment[]`, the code may crash or behave unexpectedly at runtime.

## Fix

Add type guard functions:

```tsx
// src/lib/utils/type-guards.ts
import type { ImageAttachment } from '@/lib/agent/types'

export function isImageAttachment(value: unknown): value is ImageAttachment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'image' &&
    'data' in value
  )
}

export function isImageAttachments(value: unknown): value is ImageAttachment[] {
  return Array.isArray(value) && value.every(isImageAttachment)
}
```

Usage:
```tsx
// output-renderer.tsx
const imageAttachments = isImageAttachments(chunk.attachments)
  ? chunk.attachments
  : undefined
```

## Files to Check

- `src/components/agents/output-renderer.tsx`
- Any other files using `as` type assertions with external data
