/**
 * Task path URL encoding/decoding utilities
 *
 * Task paths are simplified for clean URLs:
 *   "tasks/my-feature.md" -> "my-feature"
 *   "tasks/archive/old-task.md" -> "archive~old-task"
 */

/**
 * Encode a task file path for use in URL segments.
 * Strips "tasks/" prefix and ".md" extension, uses "~" for subdirectories.
 */
export function encodeTaskPath(taskPath: string): string {
  // Strip "tasks/" prefix
  let encoded = taskPath.replace(/^tasks\//, '')
  // Strip ".md" extension
  encoded = encoded.replace(/\.md$/, '')
  // Replace "/" with "~" for any subdirectories (e.g., archive/)
  encoded = encoded.replace(/\//g, '~')
  return encoded
}

/**
 * Decode a URL segment back to a task file path.
 * Restores "tasks/" prefix, ".md" extension, and "/" for subdirectories.
 */
export function decodeTaskPath(encoded: string): string {
  // Replace "~" with "/" for subdirectories
  let decoded = encoded.replace(/~/g, '/')
  // Add "tasks/" prefix and ".md" extension
  return `tasks/${decoded}.md`
}

/**
 * Build the URL path for viewing a task.
 * Returns "/tasks/encoded-path" for selection, or "/tasks" for no selection.
 */
export function buildTaskUrl(taskPath: string | null | undefined): string {
  if (!taskPath) return '/tasks'
  return `/tasks/${encodeTaskPath(taskPath)}`
}
