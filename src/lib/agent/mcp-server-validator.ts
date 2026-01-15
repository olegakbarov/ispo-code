/**
 * MCP Server Configuration Validator
 *
 * Provides robust validation of MCP server configurations loaded from
 * ~/.mcporter/mcporter.json including:
 * - Server address validation (URL format, DNS reachability)
 * - Malicious pattern detection with blacklist
 * - OAuth server handling (skip by default)
 * - Connection limits and pooling
 * - Idle connection timeout management
 */

import { existsSync, readFileSync, statSync } from "fs"
import { join } from "path"
import dns from "dns"
import { promisify } from "util"

const dnsLookup = promisify(dns.lookup)

// === Configuration Constants ===

/** Maximum connections per MCP server */
export const MAX_CONNECTIONS_PER_SERVER = 3

/** Maximum total connections across all servers */
export const MAX_TOTAL_CONNECTIONS = 10

/** Idle connection timeout in milliseconds (5 minutes) */
export const IDLE_CONNECTION_TIMEOUT_MS = 5 * 60 * 1000

/** DNS lookup timeout in milliseconds */
export const DNS_LOOKUP_TIMEOUT_MS = 5000

/** Maximum config file size in bytes (1MB) */
export const MAX_CONFIG_FILE_SIZE = 1024 * 1024

// === Blacklist Configuration ===

/**
 * Blacklisted hostnames and IP addresses
 * These are known dangerous or disallowed addresses
 */
export const BLACKLISTED_HOSTS = new Set([
  // Localhost variations (prevent local network attacks)
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "localhost",

  // Link-local addresses
  "169.254.0.0",

  // Private network ranges (first address)
  "10.0.0.0",
  "192.168.0.0",
  "172.16.0.0",

  // Metadata service endpoints (cloud provider security)
  "169.254.169.254", // AWS/GCP/Azure metadata
  "metadata.google.internal",
  "metadata.internal",
])

/**
 * Blacklisted hostname patterns (regex)
 */
export const BLACKLISTED_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,        // All 127.x.x.x
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fe80:/i,                       // Link-local IPv6
  /^10\.\d+\.\d+\.\d+$/,          // Private 10.x.x.x
  /^192\.168\.\d+\.\d+$/,         // Private 192.168.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // Private 172.16-31.x.x
  /metadata/i,                     // Metadata service patterns
  /internal$/i,                    // Internal domains
]

// === Types ===

export interface MCPServerConfig {
  /** Server name/identifier */
  name: string
  /** Server URL or command */
  address?: string
  /** Server URL (alternative field name) */
  url?: string
  /** Base URL for the server (alternative field name) */
  baseUrl?: string
  /** Command to start the server (for local servers) */
  command?: string
  /** Arguments for the command */
  args?: string[]
  /** Environment variables */
  env?: Record<string, string>
  /** Whether OAuth is required */
  requiresOAuth?: boolean
  /** Auth type (e.g., "oauth") */
  auth?: string
  /** OAuth configuration */
  oauth?: {
    clientId?: string
    authUrl?: string
    tokenUrl?: string
  }
}

export interface MCPConfigFile {
  servers?: Record<string, MCPServerConfig> | MCPServerConfig[]
  mcpServers?: Record<string, MCPServerConfig>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidatedServer {
  name: string
  config: MCPServerConfig
  requiresOAuth: boolean
  isLocal: boolean
}

export interface ConnectionPoolState {
  serverConnections: Map<string, number>
  totalConnections: number
  lastActivity: Map<string, number>
}

// === Validation Functions ===

/**
 * Validate a URL is well-formed and uses allowed protocols
 */
export function validateUrlFormat(url: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    const parsed = new URL(url)

    // Must use http or https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push(`Invalid protocol "${parsed.protocol}". Only http:// or https:// are allowed.`)
    }

    // Warn about non-HTTPS
    if (parsed.protocol === "http:") {
      warnings.push(`Server uses HTTP instead of HTTPS. Connection is not encrypted.`)
    }

    // Check for empty hostname
    if (!parsed.hostname) {
      errors.push("URL has no hostname")
    }

  } catch (err) {
    errors.push(`Invalid URL format: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if a hostname is in the blacklist
 */
export function isBlacklistedHost(hostname: string): boolean {
  // Direct blacklist check
  if (BLACKLISTED_HOSTS.has(hostname.toLowerCase())) {
    return true
  }

  // Pattern matching
  for (const pattern of BLACKLISTED_PATTERNS) {
    if (pattern.test(hostname)) {
      return true
    }
  }

  return false
}

/**
 * Validate hostname against blacklist and check DNS reachability
 */
export async function validateHostname(hostname: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check blacklist
  if (isBlacklistedHost(hostname)) {
    errors.push(`Hostname "${hostname}" is blacklisted for security reasons`)
    return { valid: false, errors, warnings }
  }

  // DNS lookup with timeout
  try {
    const lookupPromise = dnsLookup(hostname)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_LOOKUP_TIMEOUT_MS)
    )

    const result = await Promise.race([lookupPromise, timeoutPromise])

    // Check if resolved IP is blacklisted
    if (result && typeof result === "object" && "address" in result) {
      const resolvedIp = result.address
      if (isBlacklistedHost(resolvedIp)) {
        errors.push(`Hostname "${hostname}" resolves to blacklisted IP "${resolvedIp}"`)
      }
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("ENOTFOUND") || message.includes("ENOENT")) {
      errors.push(`Hostname "${hostname}" could not be resolved (DNS lookup failed)`)
    } else if (message.includes("timed out")) {
      warnings.push(`DNS lookup for "${hostname}" timed out - server may be unreachable`)
    } else {
      warnings.push(`DNS lookup warning for "${hostname}": ${message}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate a server address (URL or command)
 */
export async function validateServerAddress(
  config: MCPServerConfig
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const address = config.address || config.url || config.baseUrl

  // If it's a local command-based server, skip URL validation
  if (config.command && !address) {
    // Local servers are allowed - no URL validation needed
    return { valid: true, errors, warnings }
  }

  if (!address) {
    errors.push(`Server "${config.name}" has no address or command configured`)
    return { valid: false, errors, warnings }
  }

  // Validate URL format
  const urlResult = validateUrlFormat(address)
  errors.push(...urlResult.errors)
  warnings.push(...urlResult.warnings)

  if (urlResult.valid) {
    // Validate hostname
    try {
      const url = new URL(address)
      const hostnameResult = await validateHostname(url.hostname)
      errors.push(...hostnameResult.errors)
      warnings.push(...hostnameResult.warnings)
    } catch {
      // URL parsing already failed above
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if a server requires OAuth authentication
 */
export function serverRequiresOAuth(config: MCPServerConfig): boolean {
  // Explicit flag
  if (config.requiresOAuth === true) {
    return true
  }

  // Auth type set to "oauth"
  if (config.auth === "oauth") {
    return true
  }

  // Has OAuth configuration
  if (config.oauth && (config.oauth.authUrl || config.oauth.clientId)) {
    return true
  }

  return false
}

/**
 * Load and parse the MCPorter configuration file
 */
export function loadConfigFile(configPath: string): MCPConfigFile | null {
  try {
    if (!existsSync(configPath)) {
      return null
    }

    // Check file size to prevent DoS
    const stats = statSync(configPath)
    if (stats.size > MAX_CONFIG_FILE_SIZE) {
      console.error(`[MCP Validator] Config file too large: ${stats.size} bytes (max: ${MAX_CONFIG_FILE_SIZE})`)
      return null
    }

    const content = readFileSync(configPath, "utf-8")
    return JSON.parse(content) as MCPConfigFile

  } catch (err) {
    console.error(`[MCP Validator] Failed to load config: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * Get all possible config file paths
 * Supports environment variable overrides for testing:
 * - MCPORTER_CONFIG_PATH: Override with specific config file
 * - Falls back to standard paths
 */
export function getConfigPaths(): string[] {
  const home = process.env.HOME || ""
  const paths: string[] = []

  // Environment variable override takes priority
  if (process.env.MCPORTER_CONFIG_PATH) {
    paths.push(process.env.MCPORTER_CONFIG_PATH)
  }

  // Project-local test config (for test isolation)
  if (process.env.MCPORTER_TEST_MODE === "true") {
    paths.push(join(process.cwd(), "mcporter.test.json"))
  }

  // Standard config paths
  paths.push(
    join(home, ".mcporter", "mcporter.json"),
    join(home, ".config", "mcporter", "mcporter.json"),
    join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  )

  return paths
}

/**
 * Normalize server configurations from various formats
 */
export function normalizeServers(config: MCPConfigFile): MCPServerConfig[] {
  const servers: MCPServerConfig[] = []

  // Handle servers field (Record or Array)
  if (config.servers) {
    if (Array.isArray(config.servers)) {
      servers.push(...config.servers)
    } else {
      for (const [name, serverConfig] of Object.entries(config.servers)) {
        servers.push({ ...serverConfig, name })
      }
    }
  }

  // Handle mcpServers field (Claude Desktop format)
  if (config.mcpServers) {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      servers.push({ ...serverConfig, name })
    }
  }

  return servers
}

/**
 * Validate all servers in configuration
 */
export async function validateAllServers(
  servers: MCPServerConfig[],
  options: {
    skipOAuth?: boolean
    skipDnsCheck?: boolean
  } = {}
): Promise<{
  valid: ValidatedServer[]
  skipped: Array<{ name: string; reason: string }>
  errors: Array<{ name: string; errors: string[] }>
}> {
  const valid: ValidatedServer[] = []
  const skipped: Array<{ name: string; reason: string }> = []
  const errors: Array<{ name: string; errors: string[] }> = []

  const { skipOAuth = true, skipDnsCheck = false } = options

  for (const server of servers) {
    // Check OAuth requirement
    const requiresOAuth = serverRequiresOAuth(server)
    if (requiresOAuth && skipOAuth) {
      skipped.push({ name: server.name, reason: "Requires OAuth authentication" })
      continue
    }

    // Check if it's a local command-based server
    const isLocal = Boolean(server.command && !server.address && !server.url && !server.baseUrl)

    // Validate address if not local
    if (!isLocal) {
      const serverAddress = server.address || server.url || server.baseUrl || ""

      // Always check URL format first
      const urlResult = validateUrlFormat(serverAddress)
      if (!urlResult.valid) {
        errors.push({ name: server.name, errors: urlResult.errors })
        continue
      }

      // Always check blacklist (even when skipping DNS)
      try {
        const url = new URL(serverAddress)
        if (isBlacklistedHost(url.hostname)) {
          errors.push({
            name: server.name,
            errors: [`Hostname "${url.hostname}" is blacklisted for security reasons`]
          })
          continue
        }
      } catch {
        // URL parsing failed - already caught above
      }

      // Full DNS validation if not skipping
      if (!skipDnsCheck) {
        const addressResult = await validateServerAddress(server)
        if (!addressResult.valid) {
          errors.push({ name: server.name, errors: addressResult.errors })
          continue
        }
        // Log warnings from full validation
        for (const warning of addressResult.warnings) {
          console.warn(`[MCP Validator] ${server.name}: ${warning}`)
        }
      } else {
        // Log warnings from URL format check
        for (const warning of urlResult.warnings) {
          console.warn(`[MCP Validator] ${server.name}: ${warning}`)
        }
      }
    }

    valid.push({
      name: server.name,
      config: server,
      requiresOAuth,
      isLocal,
    })
  }

  return { valid, skipped, errors }
}

// === Connection Pool Management ===

/**
 * Create a new connection pool state
 */
export function createConnectionPool(): ConnectionPoolState {
  return {
    serverConnections: new Map(),
    totalConnections: 0,
    lastActivity: new Map(),
  }
}

/**
 * Check if a new connection can be acquired
 */
export function canAcquireConnection(
  pool: ConnectionPoolState,
  serverName: string
): { allowed: boolean; reason?: string } {
  // Check total limit
  if (pool.totalConnections >= MAX_TOTAL_CONNECTIONS) {
    return {
      allowed: false,
      reason: `Total connection limit reached (${MAX_TOTAL_CONNECTIONS})`,
    }
  }

  // Check per-server limit
  const serverCount = pool.serverConnections.get(serverName) || 0
  if (serverCount >= MAX_CONNECTIONS_PER_SERVER) {
    return {
      allowed: false,
      reason: `Per-server connection limit reached for "${serverName}" (${MAX_CONNECTIONS_PER_SERVER})`,
    }
  }

  return { allowed: true }
}

/**
 * Acquire a connection slot
 */
export function acquireConnection(
  pool: ConnectionPoolState,
  serverName: string
): boolean {
  const check = canAcquireConnection(pool, serverName)
  if (!check.allowed) {
    console.warn(`[MCP Validator] Connection denied: ${check.reason}`)
    return false
  }

  const current = pool.serverConnections.get(serverName) || 0
  pool.serverConnections.set(serverName, current + 1)
  pool.totalConnections++
  pool.lastActivity.set(serverName, Date.now())

  return true
}

/**
 * Release a connection slot
 */
export function releaseConnection(
  pool: ConnectionPoolState,
  serverName: string
): void {
  const current = pool.serverConnections.get(serverName) || 0
  if (current > 0) {
    pool.serverConnections.set(serverName, current - 1)
    pool.totalConnections = Math.max(0, pool.totalConnections - 1)
  }
}

/**
 * Update last activity timestamp for a server
 */
export function updateActivity(
  pool: ConnectionPoolState,
  serverName: string
): void {
  pool.lastActivity.set(serverName, Date.now())
}

/**
 * Get idle servers that should be closed
 */
export function getIdleServers(
  pool: ConnectionPoolState,
  timeoutMs: number = IDLE_CONNECTION_TIMEOUT_MS
): string[] {
  const now = Date.now()
  const idle: string[] = []

  for (const [serverName, lastActive] of pool.lastActivity) {
    const connections = pool.serverConnections.get(serverName) || 0
    if (connections > 0 && (now - lastActive) > timeoutMs) {
      idle.push(serverName)
    }
  }

  return idle
}

/**
 * Close idle connections and return the count closed
 */
export function closeIdleConnections(
  pool: ConnectionPoolState,
  timeoutMs: number = IDLE_CONNECTION_TIMEOUT_MS
): number {
  const idleServers = getIdleServers(pool, timeoutMs)
  let closed = 0

  for (const serverName of idleServers) {
    const count = pool.serverConnections.get(serverName) || 0
    pool.totalConnections -= count
    pool.serverConnections.set(serverName, 0)
    pool.lastActivity.delete(serverName)
    closed += count
    console.log(`[MCP Validator] Closed ${count} idle connection(s) to "${serverName}"`)
  }

  return closed
}

// === Main Validation Entry Point ===

/**
 * Load and validate all MCP server configurations
 *
 * Environment variable overrides:
 * - MCPORTER_SKIP_OAUTH: Override skipOAuth option
 * - MCPORTER_SKIP_DNS: Override skipDnsCheck option
 */
export async function loadAndValidateConfigs(options: {
  skipOAuth?: boolean
  skipDnsCheck?: boolean
} = {}): Promise<{
  servers: ValidatedServer[]
  skipped: Array<{ name: string; reason: string }>
  errors: Array<{ name: string; errors: string[] }>
  configPath: string | null
}> {
  // Apply environment variable overrides
  const resolvedOptions = {
    skipOAuth: process.env.MCPORTER_SKIP_OAUTH === "true" || options.skipOAuth,
    skipDnsCheck: process.env.MCPORTER_SKIP_DNS === "true" || options.skipDnsCheck,
  }

  let loadedConfig: MCPConfigFile | null = null
  let configPath: string | null = null

  // If explicit config path is set, only use that (no fallback)
  if (process.env.MCPORTER_CONFIG_PATH) {
    const explicitPath = process.env.MCPORTER_CONFIG_PATH
    const config = loadConfigFile(explicitPath)
    if (config) {
      loadedConfig = config
      configPath = explicitPath
    } else {
      return {
        servers: [],
        skipped: [],
        errors: [{ name: "config", errors: [`Config file not found: ${explicitPath}`] }],
        configPath: null,
      }
    }
  } else {
    // Try each standard config path
    const paths = getConfigPaths()
    for (const path of paths) {
      const config = loadConfigFile(path)
      if (config) {
        loadedConfig = config
        configPath = path
        break
      }
    }

    if (!loadedConfig) {
      return {
        servers: [],
        skipped: [],
        errors: [{ name: "config", errors: ["No MCPorter configuration file found"] }],
        configPath: null,
      }
    }
  }

  const servers = normalizeServers(loadedConfig)
  const result = await validateAllServers(servers, resolvedOptions)

  return {
    servers: result.valid,
    skipped: result.skipped,
    errors: result.errors,
    configPath,
  }
}
