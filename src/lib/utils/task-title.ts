/**
 * Task Title Utilities
 *
 * Helper functions for processing task titles for audio notifications.
 */

/**
 * Extracts the first N words from a task title.
 * Strips markdown formatting and truncates to word boundaries.
 *
 * @param title - The full task title
 * @param wordCount - Number of words to extract (default: 5)
 * @returns The first N words, or the full title if shorter
 *
 * @example
 * getFirstWords("audio notification should specify which task") // "audio notification should specify which"
 * getFirstWords("Fix bug", 5) // "Fix bug"
 * getFirstWords("**Bold** _italic_ text here", 3) // "Bold italic text"
 */
export function getFirstWords(title: string, wordCount: number = 5): string {
  if (!title || title.trim().length === 0) {
    return ""
  }

  // Strip markdown formatting (bold, italic, code, links)
  let cleaned = title
    // Remove bold/italic markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Remove link markdown [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove any remaining special chars that might cause issues
    .replace(/[#`]/g, "")
    .trim()

  // Split into words (by whitespace)
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0)

  // Take first N words
  const selected = words.slice(0, wordCount)

  return selected.join(" ")
}

/**
 * Generates a task snippet suitable for audio notification.
 * This is a convenience wrapper around getFirstWords with a 10-word count.
 *
 * @param title - The full task title
 * @returns The first 10 words of the title
 *
 * @example
 * getTaskSnippet("audio notification should specify which task has been completed failed say first")
 * // Returns: "audio notification should specify which task has been completed failed say"
 */
export function getTaskSnippet(title: string): string {
  return getFirstWords(title, 10)
}
