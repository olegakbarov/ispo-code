/**
 * Time formatting utilities for displaying dates and relative times
 */

/**
 * Format a date as a relative time string (e.g., "2h ago", "3d ago")
 */
export function formatTimeAgo(date: Date | string): string {
  const now = Date.now()
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then

  if (diffMs < 0) return "just now"

  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  return `${diffMonths}mo ago`
}

/**
 * Format a date as short relative time (no "ago" suffix)
 * Used for compact displays like task sessions list
 */
export function formatRelativeShort(date: Date | string): string {
  const now = Date.now()
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then

  if (diffMs < 0) return "now"

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "now"
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

/**
 * Format a date as an absolute date/time string
 * e.g., "Jan 15, 2026 at 3:45 PM"
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " at")
}

/**
 * Format a date as a short date string
 * e.g., "Jan 15, 2026"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Format a date with both absolute and relative time
 * e.g., "Jan 15, 2026 (2h ago)"
 */
export function formatDateWithRelative(date: Date | string): string {
  return `${formatDate(date)} (${formatTimeAgo(date)})`
}
