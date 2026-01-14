/**
 * Content sanitization utilities for XSS protection
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize markdown content to prevent XSS attacks
 *
 * This removes dangerous HTML/JS while preserving safe markdown formatting.
 * Use this before rendering user-generated or AI-generated content.
 */
export function sanitizeMarkdown(content: string): string {
  if (!content) return ''

  // Configure DOMPurify to be strict but allow markdown-friendly HTML
  const clean = DOMPurify.sanitize(content, {
    // Allow these tags that are commonly used in markdown
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'hr',
    ],
    // Allow these attributes
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src',
      'class', 'id',
      'data-language', // For code blocks
    ],
    // Disallow data URIs to prevent data exfiltration
    ALLOW_DATA_ATTR: false,
    // Keep comments for markdown processing
    KEEP_CONTENT: true,
  })

  return clean
}

/**
 * Sanitize plain text by escaping HTML entities
 */
export function sanitizeText(text: string): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Validate and sanitize URLs to prevent javascript: and data: schemes
 */
export function sanitizeUrl(url: string): string {
  if (!url) return ''

  const clean = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })

  // Block dangerous protocols
  const lower = clean.toLowerCase().trim()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return ''
  }

  return clean
}
