/**
 * Security and reliability configuration for agent system
 *
 * Centralized configuration for security limits, timeouts, and resource constraints
 */

/**
 * Security and reliability configuration
 */
export const SecurityConfig = {
  // === Process Limits ===

  /** Maximum time a CLI process can run before being terminated (milliseconds) */
  CLI_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour

  /** Maximum time to wait for initial output from CLI before timing out (milliseconds) */
  CLI_STARTUP_TIMEOUT_MS: 30_000, // 30 seconds

  /** Maximum number of concurrent agent sessions allowed */
  MAX_CONCURRENT_AGENTS: 3,

  // === Memory Limits ===

  /** Maximum number of messages to keep in agent conversation history */
  MAX_MESSAGE_HISTORY: 100,

  /** Maximum total output size per session (bytes) */
  MAX_OUTPUT_SIZE_BYTES: 10_000_000, // 10MB

  /** Maximum output buffer size before flushing to disk (bytes) */
  MAX_OUTPUT_BUFFER_BYTES: 1_000_000, // 1MB

  /** Maximum buffer for bash command output (bytes) */
  MAX_BASH_OUTPUT_BUFFER: 10 * 1024 * 1024, // 10MB

  // === Storage Configuration ===

  /** Delay before flushing output buffers to disk (milliseconds) */
  FLUSH_DELAY_MS: 250,

  /** Number of output chunks before triggering immediate flush */
  FLUSH_CHUNK_THRESHOLD: 10,

  /** Maximum age of completed sessions before pruning (milliseconds) */
  MAX_SESSION_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  /** Maximum number of sessions to keep in storage */
  MAX_SESSIONS_COUNT: 100,

  // === Security Configuration ===

  /** Working directory prefix - agents cannot access files outside this path */
  ALLOWED_PATH_PREFIX: process.cwd(),

  /** Enable command sandboxing to block dangerous commands */
  ENABLE_COMMAND_SANDBOXING: true,

  /** Commands that are blocked by the bash tool */
  DANGEROUS_COMMANDS: [
    'rm -rf /',
    'rm -rf /*',
    'sudo rm',
    '> /dev/sda',
    'mkfs',
    'dd if=',
    ':(){:|:&};:',  // Fork bomb
    'curl | bash',
    'wget | sh',
    'curl | sh',
  ] as const,

  // === Tool Configuration ===

  /** Default timeout for bash commands (milliseconds) */
  BASH_DEFAULT_TIMEOUT_MS: 30_000, // 30 seconds

  /** Maximum number of grep results to return */
  GREP_MAX_RESULTS: 50,

  // === Rate Limiting ===

  /** Maximum requests per user/session per minute */
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,

  /** Maximum tokens allowed per single request */
  RATE_LIMIT_MAX_TOKENS_PER_REQUEST: 50_000,

  /** Maximum total tokens per user/session per minute */
  RATE_LIMIT_TOKENS_PER_MINUTE: 200_000,

  /** Maximum total tokens per user/session per hour */
  RATE_LIMIT_TOKENS_PER_HOUR: 1_000_000,

  /** Duration to suspend account after rate limit violations (milliseconds) */
  RATE_LIMIT_SUSPENSION_DURATION_MS: 15 * 60 * 1000, // 15 minutes

  /** Number of violations before permanent suspension */
  RATE_LIMIT_MAX_VIOLATIONS: 5,

  /** Enable rate limiting */
  RATE_LIMIT_ENABLED: true,
} as const

/**
 * Get configuration value with optional override
 */
export function getConfig<K extends keyof typeof SecurityConfig>(
  key: K,
  override?: typeof SecurityConfig[K]
): typeof SecurityConfig[K] {
  return override ?? SecurityConfig[key]
}

/**
 * Runtime configuration that can be modified
 */
export const RuntimeConfig = {
  /** Enable verbose logging for debugging */
  verboseLogging: false,

  /** Enable development mode features */
  devMode: process.env.NODE_ENV === 'development',
}

/**
 * Validate that configuration values are within safe bounds
 */
export function validateConfig(): void {
  const errors: string[] = []

  if (SecurityConfig.MAX_OUTPUT_BUFFER_BYTES > SecurityConfig.MAX_OUTPUT_SIZE_BYTES) {
    errors.push('MAX_OUTPUT_BUFFER_BYTES cannot exceed MAX_OUTPUT_SIZE_BYTES')
  }

  if (SecurityConfig.CLI_STARTUP_TIMEOUT_MS >= SecurityConfig.CLI_TIMEOUT_MS) {
    errors.push('CLI_STARTUP_TIMEOUT_MS must be less than CLI_TIMEOUT_MS')
  }

  if (SecurityConfig.MAX_CONCURRENT_AGENTS < 1) {
    errors.push('MAX_CONCURRENT_AGENTS must be at least 1')
  }

  if (SecurityConfig.RATE_LIMIT_TOKENS_PER_MINUTE > SecurityConfig.RATE_LIMIT_TOKENS_PER_HOUR) {
    errors.push('RATE_LIMIT_TOKENS_PER_MINUTE cannot exceed RATE_LIMIT_TOKENS_PER_HOUR')
  }

  if (SecurityConfig.RATE_LIMIT_REQUESTS_PER_MINUTE < 1) {
    errors.push('RATE_LIMIT_REQUESTS_PER_MINUTE must be at least 1')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid SecurityConfig:\n${errors.join('\n')}`)
  }
}

// Validate configuration on module load
validateConfig()
