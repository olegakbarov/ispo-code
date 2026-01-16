/**
 * Shared slugify utility for task path generation.
 * Used by both client (optimistic) and server (actual) to ensure path parity.
 */

/**
 * Generate a slug from a task title.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens.
 * Returns "task" if result is empty.
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "task"
}

/**
 * Generate a short slug from a task title for use as filename prefix.
 * Extracts first 3 meaningful words (skipping common stop words).
 * Example: "implement auth system with oauth" -> "implement-auth-system"
 */
export function generateShortSlug(title: string, maxWords = 3): string {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "under",
    "again", "further", "then", "once", "here", "there", "when", "where",
    "why", "how", "all", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "just", "and", "but", "if", "or", "because", "until", "while",
    "this", "that", "these", "those", "it", "we", "you", "they",
  ])

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .slice(0, maxWords)

  const slug = words.join("-")
  return slug || "task"
}

/**
 * Generate an optimistic task path from title and existing task list.
 * Attempts to predict server-generated path by checking for collisions.
 *
 * @param title - Task title
 * @param existingPaths - Set of existing task paths for collision detection
 * @param prefix - Optional prefix for the filename
 * @returns Optimistic path like "tasks/my-task.md" or "tasks/my-task-2.md"
 */
export function generateOptimisticTaskPath(
  title: string,
  existingPaths: Set<string>,
  prefix?: string
): string {
  const slugBase = slugifyTitle(title)
  const fullSlug = prefix ? `${prefix}-${slugBase}` : slugBase

  let candidate = `tasks/${fullSlug}.md`
  let i = 2

  while (existingPaths.has(candidate)) {
    candidate = `tasks/${fullSlug}-${i}.md`
    i++
  }

  return candidate
}
