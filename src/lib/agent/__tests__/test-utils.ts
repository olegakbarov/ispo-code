/**
 * Test Utilities for MCPorter Configuration Tests
 *
 * Provides helpers for creating, managing, and cleaning up
 * test configuration files with proper environment isolation.
 */

import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// === Types ===

export interface TestMCPServer {
  description?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  baseUrl?: string
  url?: string
  auth?: string
  requiresOAuth?: boolean
  oauth?: {
    authUrl?: string
    tokenUrl?: string
    clientId?: string
  }
}

export interface TestConfigOptions {
  servers?: Record<string, TestMCPServer>
  imports?: string[]
}

// === Fixtures Directory ===

export const FIXTURES_DIR = join(__dirname, 'fixtures')

export const FIXTURE_PATHS = {
  valid: join(FIXTURES_DIR, 'mcporter.valid.json'),
  empty: join(FIXTURES_DIR, 'mcporter.empty.json'),
  oauthOnly: join(FIXTURES_DIR, 'mcporter.oauth-only.json'),
  blacklisted: join(FIXTURES_DIR, 'mcporter.blacklisted.json'),
  invalid: join(FIXTURES_DIR, 'mcporter.invalid.json'),
  mixed: join(FIXTURES_DIR, 'mcporter.mixed.json'),
} as const

// === Config File Helpers ===

/**
 * Create a temporary test config file
 */
export function createTestConfig(
  path: string,
  options: TestConfigOptions
): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const config = {
    mcpServers: options.servers ?? {},
    imports: options.imports ?? [],
  }

  writeFileSync(path, JSON.stringify(config, null, 2))
}

/**
 * Clean up test config file
 */
export function cleanupTestConfig(path: string): void {
  if (existsSync(path)) {
    rmSync(path)
  }
}

/**
 * Create a temporary config for a single test
 * Returns a cleanup function
 */
export function withTempConfig(
  options: TestConfigOptions
): { path: string; cleanup: () => void } {
  const path = join(FIXTURES_DIR, `mcporter.temp.${Date.now()}.json`)
  createTestConfig(path, options)

  return {
    path,
    cleanup: () => cleanupTestConfig(path),
  }
}

// === Environment Helpers ===

interface EnvSnapshot {
  MCPORTER_CONFIG_PATH?: string
  MCPORTER_SKIP_DNS?: string
  MCPORTER_SKIP_OAUTH?: string
  MCPORTER_TEST_MODE?: string
}

/**
 * Set up test environment variables
 * Returns a cleanup function to restore original state
 */
export function setupTestEnv(configPath: string): () => void {
  const originalEnv: EnvSnapshot = {
    MCPORTER_CONFIG_PATH: process.env.MCPORTER_CONFIG_PATH,
    MCPORTER_SKIP_DNS: process.env.MCPORTER_SKIP_DNS,
    MCPORTER_SKIP_OAUTH: process.env.MCPORTER_SKIP_OAUTH,
    MCPORTER_TEST_MODE: process.env.MCPORTER_TEST_MODE,
  }

  process.env.MCPORTER_CONFIG_PATH = configPath
  process.env.MCPORTER_SKIP_DNS = 'true'
  process.env.MCPORTER_SKIP_OAUTH = 'true'
  process.env.MCPORTER_TEST_MODE = 'true'

  // Return cleanup function
  return () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

/**
 * Setup test environment with custom options
 */
export function setupTestEnvCustom(options: {
  configPath?: string
  skipDns?: boolean
  skipOAuth?: boolean
  testMode?: boolean
}): () => void {
  const originalEnv: EnvSnapshot = {
    MCPORTER_CONFIG_PATH: process.env.MCPORTER_CONFIG_PATH,
    MCPORTER_SKIP_DNS: process.env.MCPORTER_SKIP_DNS,
    MCPORTER_SKIP_OAUTH: process.env.MCPORTER_SKIP_OAUTH,
    MCPORTER_TEST_MODE: process.env.MCPORTER_TEST_MODE,
  }

  if (options.configPath !== undefined) {
    process.env.MCPORTER_CONFIG_PATH = options.configPath
  }
  if (options.skipDns !== undefined) {
    process.env.MCPORTER_SKIP_DNS = String(options.skipDns)
  }
  if (options.skipOAuth !== undefined) {
    process.env.MCPORTER_SKIP_OAUTH = String(options.skipOAuth)
  }
  if (options.testMode !== undefined) {
    process.env.MCPORTER_TEST_MODE = String(options.testMode)
  }

  return () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

// === Test Assertions ===

/**
 * Assert that a server was validated successfully
 */
export function expectServerValidated(
  result: { servers: Array<{ name: string }> },
  serverName: string
): void {
  const found = result.servers.find(s => s.name === serverName)
  if (!found) {
    throw new Error(
      `Expected server "${serverName}" to be validated, but it was not found.\n` +
      `Validated servers: ${result.servers.map(s => s.name).join(', ') || '(none)'}`
    )
  }
}

/**
 * Assert that a server was skipped
 */
export function expectServerSkipped(
  result: { skipped: Array<{ name: string; reason: string }> },
  serverName: string,
  reasonContains?: string
): void {
  const found = result.skipped.find(s => s.name === serverName)
  if (!found) {
    throw new Error(
      `Expected server "${serverName}" to be skipped, but it was not found.\n` +
      `Skipped servers: ${result.skipped.map(s => s.name).join(', ') || '(none)'}`
    )
  }
  if (reasonContains && !found.reason.toLowerCase().includes(reasonContains.toLowerCase())) {
    throw new Error(
      `Expected skip reason for "${serverName}" to contain "${reasonContains}",\n` +
      `but got: "${found.reason}"`
    )
  }
}

/**
 * Assert that a server had validation errors
 */
export function expectServerError(
  result: { errors: Array<{ name: string; errors: string[] }> },
  serverName: string,
  errorContains?: string
): void {
  const found = result.errors.find(s => s.name === serverName)
  if (!found) {
    throw new Error(
      `Expected server "${serverName}" to have errors, but it was not found.\n` +
      `Errored servers: ${result.errors.map(s => s.name).join(', ') || '(none)'}`
    )
  }
  if (errorContains) {
    const hasMatch = found.errors.some(e =>
      e.toLowerCase().includes(errorContains.toLowerCase())
    )
    if (!hasMatch) {
      throw new Error(
        `Expected error for "${serverName}" to contain "${errorContains}",\n` +
        `but got: ${found.errors.join('; ')}`
      )
    }
  }
}
