/**
 * MCP Server Validator Tests
 *
 * Tests configuration parsing, validation, and security checks
 * for the MCPorter agent's MCP server configuration.
 *
 * Run with: npx vitest run src/lib/agent/__tests__/mcp-server-validator.test.ts
 *
 * Note: Requires vitest to be installed:
 *   pnpm add -D vitest
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  loadConfigFile,
  normalizeServers,
  validateUrlFormat,
  validateHostname,
  validateServerAddress,
  serverRequiresOAuth,
  validateAllServers,
  loadAndValidateConfigs,
  getConfigPaths,
  isBlacklistedHost,
  type MCPServerConfig,
  type MCPConfigFile,
} from '../mcp-server-validator'
import {
  FIXTURE_PATHS,
  setupTestEnv,
  setupTestEnvCustom,
  withTempConfig,
  expectServerValidated,
  expectServerSkipped,
  expectServerError,
} from './test-utils'

// === URL Format Validation ===

describe('validateUrlFormat', () => {
  it('should accept valid HTTPS URLs', () => {
    const result = validateUrlFormat('https://example.com/mcp')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should accept valid HTTP URLs with warning', () => {
    const result = validateUrlFormat('http://example.com/mcp')
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('HTTP'))).toBe(true)
  })

  it('should reject invalid protocols', () => {
    const result = validateUrlFormat('ftp://example.com/mcp')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('protocol')
  })

  it('should reject malformed URLs', () => {
    const result = validateUrlFormat('not-a-url')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid URL')
  })

  it('should reject relative URLs', () => {
    const result = validateUrlFormat('/just/a/path')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid URL')
  })
})

// === Hostname Blacklist ===

describe('isBlacklistedHost', () => {
  it('should block localhost', () => {
    expect(isBlacklistedHost('localhost')).toBe(true)
    expect(isBlacklistedHost('LOCALHOST')).toBe(true) // Case insensitive
  })

  it('should block loopback addresses', () => {
    expect(isBlacklistedHost('127.0.0.1')).toBe(true)
    expect(isBlacklistedHost('127.0.0.2')).toBe(true)
    expect(isBlacklistedHost('127.255.255.255')).toBe(true)
  })

  it('should block private network ranges', () => {
    expect(isBlacklistedHost('10.0.0.1')).toBe(true)
    expect(isBlacklistedHost('192.168.1.1')).toBe(true)
    expect(isBlacklistedHost('172.16.0.1')).toBe(true)
    expect(isBlacklistedHost('172.31.255.255')).toBe(true)
  })

  it('should block cloud metadata endpoints', () => {
    expect(isBlacklistedHost('169.254.169.254')).toBe(true)
    expect(isBlacklistedHost('metadata.google.internal')).toBe(true)
  })

  it('should allow public hosts', () => {
    expect(isBlacklistedHost('example.com')).toBe(false)
    expect(isBlacklistedHost('api.github.com')).toBe(false)
    expect(isBlacklistedHost('8.8.8.8')).toBe(false)
  })
})

// === Hostname Validation ===

describe('validateHostname', () => {
  it('should reject blacklisted hostnames', async () => {
    const result = await validateHostname('localhost')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('blacklisted')
  })

  it('should reject blacklisted IP addresses', async () => {
    const result = await validateHostname('127.0.0.1')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('blacklisted')
  })

  it('should warn on DNS lookup failure for unknown hosts', async () => {
    const result = await validateHostname('this-host-definitely-does-not-exist-12345.com')
    // Should have warning or error about DNS
    expect(result.warnings.length > 0 || result.errors.length > 0).toBe(true)
  })
})

// === Server Address Validation ===

describe('validateServerAddress', () => {
  it('should accept local command-based servers', async () => {
    const config: MCPServerConfig = {
      name: 'test-local',
      command: 'node',
      args: ['./server.js'],
    }
    const result = await validateServerAddress(config)
    expect(result.valid).toBe(true)
  })

  it('should reject servers without address or command', async () => {
    const config: MCPServerConfig = {
      name: 'test-empty',
    }
    const result = await validateServerAddress(config)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('no address or command')
  })

  it('should validate URL-based servers', async () => {
    const config: MCPServerConfig = {
      name: 'test-url',
      url: 'https://api.example.com/mcp',
    }
    // Note: This may fail DNS check in test environment
    // We're mainly testing the validation flow
    const result = await validateServerAddress(config)
    // URL format should be valid even if DNS fails
    expect(result.errors.filter(e => e.includes('Invalid URL'))).toHaveLength(0)
  })
})

// === OAuth Detection ===

describe('serverRequiresOAuth', () => {
  it('should detect explicit OAuth flag', () => {
    expect(serverRequiresOAuth({ name: 'test', requiresOAuth: true })).toBe(true)
    expect(serverRequiresOAuth({ name: 'test', requiresOAuth: false })).toBe(false)
  })

  it('should detect OAuth config object', () => {
    expect(serverRequiresOAuth({
      name: 'test',
      oauth: { authUrl: 'https://auth.example.com' }
    })).toBe(true)

    expect(serverRequiresOAuth({
      name: 'test',
      oauth: { clientId: 'test-client' }
    })).toBe(true)
  })

  it('should return false for non-OAuth servers', () => {
    expect(serverRequiresOAuth({ name: 'test', command: 'node' })).toBe(false)
    expect(serverRequiresOAuth({ name: 'test', url: 'https://example.com' })).toBe(false)
  })
})

// === Config File Loading ===

describe('loadConfigFile', () => {
  it('should load valid JSON config', () => {
    const config = loadConfigFile(FIXTURE_PATHS.valid)
    expect(config).not.toBeNull()
    expect(config?.mcpServers).toBeDefined()
  })

  it('should return null for non-existent file', () => {
    const config = loadConfigFile('/nonexistent/path/mcporter.json')
    expect(config).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    const config = loadConfigFile(FIXTURE_PATHS.invalid)
    expect(config).toBeNull()
  })
})

// === Server Normalization ===

describe('normalizeServers', () => {
  it('should normalize mcpServers object format', () => {
    // Config files have the server name as key, not in the object
    // normalizeServers adds the name from the key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: MCPConfigFile = {
      mcpServers: {
        'server-a': { url: 'https://a.example.com' },
        'server-b': { command: 'node', args: ['server.js'] },
      } as any,
    }

    const servers = normalizeServers(config)
    expect(servers).toHaveLength(2)
    expect(servers.find(s => s.name === 'server-a')).toBeDefined()
    expect(servers.find(s => s.name === 'server-b')).toBeDefined()
  })

  it('should handle empty config', () => {
    const servers = normalizeServers({})
    expect(servers).toHaveLength(0)
  })

  it('should handle both servers and mcpServers fields', () => {
    // Config files have the server name as key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: MCPConfigFile = {
      servers: {
        'server-a': { url: 'https://a.example.com' },
      } as any,
      mcpServers: {
        'server-b': { url: 'https://b.example.com' },
      } as any,
    }

    const servers = normalizeServers(config)
    expect(servers).toHaveLength(2)
  })
})

// === Full Validation Flow ===

describe('validateAllServers', () => {
  it('should validate local command servers', async () => {
    const servers: MCPServerConfig[] = [
      { name: 'local-1', command: 'node', args: ['server.js'] },
      { name: 'local-2', command: 'echo', args: ['test'] },
    ]

    const result = await validateAllServers(servers, { skipDnsCheck: true })
    expect(result.valid).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })

  it('should skip OAuth servers when skipOAuth is true', async () => {
    const servers: MCPServerConfig[] = [
      { name: 'oauth-server', url: 'https://example.com', requiresOAuth: true },
      { name: 'normal-server', command: 'node' },
    ]

    const result = await validateAllServers(servers, { skipOAuth: true, skipDnsCheck: true })
    expect(result.valid).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].name).toBe('oauth-server')
  })

  it('should report errors for blacklisted servers', async () => {
    const servers: MCPServerConfig[] = [
      { name: 'localhost-server', url: 'http://localhost:3000/mcp' },
    ]

    const result = await validateAllServers(servers, { skipDnsCheck: true })
    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].name).toBe('localhost-server')
    expect(result.errors[0].errors[0]).toContain('blacklisted')
  })
})

// === Environment Variable Overrides ===

describe('getConfigPaths', () => {
  let cleanup: () => void

  afterEach(() => {
    if (cleanup) cleanup()
  })

  it('should prioritize MCPORTER_CONFIG_PATH env var', () => {
    cleanup = setupTestEnvCustom({ configPath: '/custom/path/mcporter.json' })

    const paths = getConfigPaths()
    expect(paths[0]).toBe('/custom/path/mcporter.json')
  })

  it('should include project-local config in test mode', () => {
    cleanup = setupTestEnvCustom({ testMode: true })

    const paths = getConfigPaths()
    const hasProjectLocal = paths.some(p => p.includes('mcporter.test.json'))
    expect(hasProjectLocal).toBe(true)
  })

  it('should include standard paths', () => {
    // Ensure no env overrides
    delete process.env.MCPORTER_CONFIG_PATH
    delete process.env.MCPORTER_TEST_MODE

    const paths = getConfigPaths()
    const hasStandardPath = paths.some(p => p.includes('.mcporter'))
    expect(hasStandardPath).toBe(true)
  })
})

// === Integration: loadAndValidateConfigs ===

describe('loadAndValidateConfigs', () => {
  let cleanup: () => void

  afterEach(() => {
    if (cleanup) cleanup()
  })

  it('should load and validate config from fixture path', async () => {
    cleanup = setupTestEnv(FIXTURE_PATHS.valid)

    const result = await loadAndValidateConfigs()
    expect(result.configPath).toBe(FIXTURE_PATHS.valid)
    expect(result.servers.length).toBeGreaterThan(0)
  })

  it('should return error for missing config', async () => {
    cleanup = setupTestEnv('/nonexistent/mcporter.json')

    const result = await loadAndValidateConfigs()
    expect(result.servers).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].name).toBe('config')
  })

  it('should skip OAuth servers by default', async () => {
    cleanup = setupTestEnv(FIXTURE_PATHS.oauthOnly)

    const result = await loadAndValidateConfigs()
    expect(result.servers).toHaveLength(0)
    expect(result.skipped.length).toBeGreaterThan(0)
    expectServerSkipped(result, 'oauth-server', 'OAuth')
  })

  it('should report errors for blacklisted hosts', async () => {
    cleanup = setupTestEnv(FIXTURE_PATHS.blacklisted)

    const result = await loadAndValidateConfigs()
    expect(result.errors.length).toBeGreaterThan(0)

    // All servers in blacklisted config should have errors
    expectServerError(result, 'localhost-attack', 'blacklisted')
    expectServerError(result, 'metadata-attack', 'blacklisted')
  })

  it('should handle empty config gracefully', async () => {
    cleanup = setupTestEnv(FIXTURE_PATHS.empty)

    const result = await loadAndValidateConfigs()
    expect(result.servers).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })

  it('should handle mixed valid/invalid servers', async () => {
    cleanup = setupTestEnv(FIXTURE_PATHS.mixed)

    const result = await loadAndValidateConfigs()

    // Should have valid local server
    expectServerValidated(result, 'valid-local')

    // OAuth server should be skipped
    expectServerSkipped(result, 'oauth-server', 'OAuth')

    // Blacklisted server should error
    expectServerError(result, 'blacklisted', 'blacklisted')
  })

  it('should respect MCPORTER_SKIP_DNS env var', async () => {
    cleanup = setupTestEnvCustom({
      configPath: FIXTURE_PATHS.valid,
      skipDns: true,
      skipOAuth: true,
    })

    // With DNS skip, remote servers should validate (URL format only)
    const result = await loadAndValidateConfigs()
    // Config should be loaded from the valid fixture
    expect(result.configPath).toBe(FIXTURE_PATHS.valid)
    // Should have at least the local command servers
    expect(result.servers.length).toBeGreaterThan(0)
  })
})

// === Dynamic Config Creation Tests ===

describe('Dynamic config creation', () => {
  it('should work with dynamically created configs', async () => {
    const { path, cleanup: cleanupConfig } = withTempConfig({
      servers: {
        'dynamic-local': {
          command: 'node',
          args: ['test.js'],
        },
      },
    })

    const cleanupEnv = setupTestEnv(path)

    try {
      const result = await loadAndValidateConfigs()
      expect(result.configPath).toBe(path)
      expectServerValidated(result, 'dynamic-local')
    } finally {
      cleanupEnv()
      cleanupConfig()
    }
  })
})
