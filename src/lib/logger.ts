/**
 * Structured logging utility for consistent log formatting across the app
 *
 * Features:
 * - Consistent prefix format: [Component:Action]
 * - Log levels: info, warn, error, debug
 * - Duration tracking for performance monitoring
 * - Payload truncation to avoid log spam
 */

interface LogOptions {
  /** Truncate string values longer than this (default: 200) */
  maxStringLength?: number
  /** Include timestamp in logs */
  timestamp?: boolean
}

const DEFAULT_OPTIONS: LogOptions = {
  maxStringLength: 200,
  timestamp: true,
}

/**
 * Truncate long strings in objects for logging
 */
function truncateValue(value: unknown, maxLength: number): unknown {
  if (typeof value === 'string' && value.length > maxLength) {
    return value.slice(0, maxLength) + `... (${value.length} chars)`
  }
  if (Array.isArray(value)) {
    if (value.length > 10) {
      return [...value.slice(0, 10).map(v => truncateValue(v, maxLength)), `... (${value.length} items)`]
    }
    return value.map(v => truncateValue(v, maxLength))
  }
  if (value && typeof value === 'object') {
    const truncated: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      truncated[k] = truncateValue(v, maxLength)
    }
    return truncated
  }
  return value
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(component: string, options: LogOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const formatPrefix = (action: string) => {
    const ts = opts.timestamp ? `${new Date().toISOString()} ` : ''
    return `${ts}[${component}:${action}]`
  }

  const formatPayload = (payload?: unknown) => {
    if (payload === undefined) return ''
    const truncated = truncateValue(payload, opts.maxStringLength ?? 200)
    return typeof truncated === 'object' ? JSON.stringify(truncated) : String(truncated)
  }

  return {
    info(action: string, message?: string, payload?: unknown) {
      const parts = [formatPrefix(action)]
      if (message) parts.push(message)
      if (payload !== undefined) parts.push(formatPayload(payload))
      console.log(parts.join(' '))
    },

    warn(action: string, message?: string, payload?: unknown) {
      const parts = [formatPrefix(action)]
      if (message) parts.push(message)
      if (payload !== undefined) parts.push(formatPayload(payload))
      console.warn(parts.join(' '))
    },

    error(action: string, message?: string, error?: unknown) {
      const parts = [formatPrefix(action)]
      if (message) parts.push(message)
      if (error instanceof Error) {
        parts.push(`Error: ${error.message}`)
        if (error.stack) {
          console.error(parts.join(' '), '\nStack:', error.stack)
          return
        }
      } else if (error !== undefined) {
        parts.push(formatPayload(error))
      }
      console.error(parts.join(' '))
    },

    debug(action: string, message?: string, payload?: unknown) {
      if (process.env.NODE_ENV === 'production') return
      const parts = [formatPrefix(action)]
      if (message) parts.push(message)
      if (payload !== undefined) parts.push(formatPayload(payload))
      console.debug(parts.join(' '))
    },

    /**
     * Create a timer for measuring operation duration
     */
    startTimer(action: string) {
      const start = performance.now()
      return {
        end(message?: string, payload?: unknown) {
          const duration = Math.round(performance.now() - start)
          const parts = [formatPrefix(action)]
          if (message) parts.push(message)
          parts.push(`(${duration}ms)`)
          if (payload !== undefined) parts.push(formatPayload(payload))
          console.log(parts.join(' '))
          return duration
        },
        endWithError(message?: string, error?: unknown) {
          const duration = Math.round(performance.now() - start)
          const parts = [formatPrefix(action)]
          if (message) parts.push(message)
          parts.push(`(${duration}ms)`)
          if (error instanceof Error) {
            parts.push(`Error: ${error.message}`)
          }
          console.error(parts.join(' '))
          return duration
        }
      }
    }
  }
}

/** Pre-configured loggers for common components */
export const trpcLogger = createLogger('tRPC')
export const agentLogger = createLogger('Agent')
export const gitLogger = createLogger('Git')
export const taskLogger = createLogger('Task')
export const daemonLogger = createLogger('Daemon')
