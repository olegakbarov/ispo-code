# Test Environment Configuration

<!-- splitFrom: tasks/add-qa-agent-using-mcporter-https-github-com-steipete-mcporter.md -->

## Problem Statement
New QA agent type using MCPorter for MCP tool discovery/invocation. Standalone agent spawned from `/` route with user prompt, not tied to task workflows.

## Scope
**In:**
- New `mcporter` agent type in agent system
- MCPorter runtime for MCP tool discovery
- Standalone spawn flow (prompt-based, like other agents)
- QA-focused system prompt
- UI integration in agent selector on index page

**Out:**
- Task-linked spawning (no `createWithAgent`, `assignToAgent` integration)
- MCPorter CLI generation features
- OAuth flow handling
- Custom MCP server configuration UI

## Implementation Plan

- [x] Specify how the `mcporter.json` configuration file will be managed in the test environment.
- [x] Provide detailed instructions on how to create and manage a test `mcporter.json` file, including sample configurations. Also, specify how to start and stop mock MCP servers for testing purposes, and how to clean up any created resources after tests complete.
- [x] Provide a default configuration file for testing purposes.
- [x] Add tests to verify that the agent correctly parses and uses the configuration file, including handling of invalid or missing entries.

## Test Environment Configuration Specification

### Configuration Management Strategy

The test environment uses **environment variable overrides** combined with **fixture files** to isolate tests from production configurations.

#### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MCPORTER_CONFIG_PATH` | Override config file path | `~/.mcporter/mcporter.json` |
| `MCPORTER_TEST_MODE` | Enable test mode (skip DNS, OAuth) | `false` |
| `MCPORTER_SKIP_OAUTH` | Skip OAuth servers in validation | `true` |
| `MCPORTER_SKIP_DNS` | Skip DNS reachability checks | `false` |

#### Test Fixture Locations

```
src/lib/agent/__tests__/
├── fixtures/
│   ├── mcporter.valid.json         # Valid config with mock servers
│   ├── mcporter.empty.json         # Empty servers config
│   ├── mcporter.invalid.json       # Malformed JSON
│   ├── mcporter.oauth-only.json    # Only OAuth servers
│   └── mcporter.blacklisted.json   # Blacklisted hosts
├── mcp-server-validator.test.ts    # Validator tests
└── mcporter.test.ts                # MCPorter agent tests
```

#### Config Resolution Order (Test Mode)

1. `MCPORTER_CONFIG_PATH` env var (highest priority)
2. `process.cwd()/mcporter.test.json` (project-local test config)
3. Standard paths (`~/.mcporter/`, `~/.config/mcporter/`)

### Mock MCP Server Strategy

For testing, we use **local command-based mock servers** rather than HTTP servers:

```json
{
  "mcpServers": {
    "mock-qa": {
      "description": "Mock QA server for testing",
      "command": "node",
      "args": ["./scripts/mock-mcp-server.js"]
    }
  }
}
```

This avoids network dependencies and port conflicts during parallel test runs.

---

## Detailed Test Configuration Guide

### Creating a Test `mcporter.json` File

#### Step 1: Create the Test Fixtures Directory

```bash
mkdir -p src/lib/agent/__tests__/fixtures
```

#### Step 2: Create Test Configuration Files

**Valid Configuration (`mcporter.valid.json`):**
```json
{
  "mcpServers": {
    "mock-qa": {
      "description": "Mock QA server for unit tests",
      "command": "node",
      "args": ["./scripts/mock-mcp-server.js"],
      "env": {
        "MCP_TEST_MODE": "true"
      }
    },
    "mock-tools": {
      "description": "Mock tools server with file operations",
      "command": "npx",
      "args": ["-y", "echo-mcp-server@latest"]
    }
  }
}
```

**Empty Configuration (`mcporter.empty.json`):**
```json
{
  "mcpServers": {}
}
```

**OAuth-Only Configuration (`mcporter.oauth-only.json`):**
```json
{
  "mcpServers": {
    "oauth-server": {
      "description": "Server requiring OAuth",
      "baseUrl": "https://api.example.com/mcp",
      "auth": "oauth",
      "tokenCacheDir": "~/.mcporter/test-oauth"
    }
  }
}
```

**Blacklisted Hosts Configuration (`mcporter.blacklisted.json`):**
```json
{
  "mcpServers": {
    "local-attack": {
      "description": "Attempts localhost connection",
      "baseUrl": "http://localhost:3000/mcp"
    },
    "metadata-attack": {
      "description": "Attempts cloud metadata endpoint",
      "baseUrl": "http://169.254.169.254/mcp"
    }
  }
}
```

### Starting and Stopping Mock MCP Servers

#### Option 1: Command-Based Servers (Recommended)

Mock servers defined with `command` property start automatically when MCPorter connects:

```json
{
  "mcpServers": {
    "mock-qa": {
      "command": "node",
      "args": ["./scripts/mock-mcp-server.js"]
    }
  }
}
```

MCPorter handles lifecycle:
- **Start**: Spawned on first `listTools()` call
- **Stop**: Killed when runtime closes (`runtime.close()`)

#### Option 2: Manual Mock Server for Integration Tests

Create `scripts/mock-mcp-server.js`:

```javascript
#!/usr/bin/env node
/**
 * Mock MCP Server for Testing
 * Implements minimal MCP protocol over stdio
 */

const readline = require('readline');

const TOOLS = [
  {
    name: "run_test",
    description: "Run a test case",
    inputSchema: {
      type: "object",
      properties: {
        testName: { type: "string", description: "Test name" }
      },
      required: ["testName"]
    }
  },
  {
    name: "validate_config",
    description: "Validate configuration",
    inputSchema: {
      type: "object",
      properties: {
        configPath: { type: "string" }
      }
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function respond(id, result) {
  console.log(JSON.stringify({ jsonrpc: "2.0", id, result }));
}

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);

    if (msg.method === "initialize") {
      respond(msg.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mock-mcp-server", version: "1.0.0" }
      });
    } else if (msg.method === "tools/list") {
      respond(msg.id, { tools: TOOLS });
    } else if (msg.method === "tools/call") {
      // Simulate tool execution
      respond(msg.id, {
        content: [{ type: "text", text: `Executed: ${msg.params?.name}` }]
      });
    }
  } catch (err) {
    console.error(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }));
  }
});
```

### Test Cleanup Procedures

#### In Test Setup/Teardown (Vitest)

```typescript
import { describe, it, beforeEach, afterEach, afterAll } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_CONFIG_DIR = join(__dirname, 'fixtures');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'mcporter.test.json');

describe('MCPorter Config Tests', () => {
  beforeEach(() => {
    // Set test mode environment
    process.env.MCPORTER_CONFIG_PATH = TEST_CONFIG_PATH;
    process.env.MCPORTER_SKIP_DNS = 'true';
    process.env.MCPORTER_SKIP_OAUTH = 'true';
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.MCPORTER_CONFIG_PATH;
    delete process.env.MCPORTER_SKIP_DNS;
    delete process.env.MCPORTER_SKIP_OAUTH;
  });

  afterAll(() => {
    // Clean up any temporary files created during tests
    const tempFiles = ['mcporter.temp.json', 'mcporter.generated.json'];
    for (const file of tempFiles) {
      const path = join(TEST_CONFIG_DIR, file);
      if (existsSync(path)) {
        rmSync(path);
      }
    }
  });
});
```

#### Helper Functions for Test Isolation

```typescript
// src/lib/agent/__tests__/test-utils.ts

import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface TestConfigOptions {
  servers?: Record<string, object>;
  imports?: string[];
}

/**
 * Create a temporary test config file
 */
export function createTestConfig(
  path: string,
  options: TestConfigOptions
): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const config = {
    mcpServers: options.servers ?? {},
    imports: options.imports ?? [],
  };

  writeFileSync(path, JSON.stringify(config, null, 2));
}

/**
 * Clean up test config file
 */
export function cleanupTestConfig(path: string): void {
  if (existsSync(path)) {
    rmSync(path);
  }
}

/**
 * Set up test environment variables
 */
export function setupTestEnv(configPath: string): () => void {
  const originalEnv = {
    MCPORTER_CONFIG_PATH: process.env.MCPORTER_CONFIG_PATH,
    MCPORTER_SKIP_DNS: process.env.MCPORTER_SKIP_DNS,
    MCPORTER_SKIP_OAUTH: process.env.MCPORTER_SKIP_OAUTH,
    MCPORTER_TEST_MODE: process.env.MCPORTER_TEST_MODE,
  };

  process.env.MCPORTER_CONFIG_PATH = configPath;
  process.env.MCPORTER_SKIP_DNS = 'true';
  process.env.MCPORTER_SKIP_OAUTH = 'true';
  process.env.MCPORTER_TEST_MODE = 'true';

  // Return cleanup function
  return () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}
```

---

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/agent/__tests__/fixtures/mcporter.valid.json` | Valid config with local command and remote HTTPS servers |
| `src/lib/agent/__tests__/fixtures/mcporter.empty.json` | Empty servers config for edge case testing |
| `src/lib/agent/__tests__/fixtures/mcporter.oauth-only.json` | Config with only OAuth-requiring servers |
| `src/lib/agent/__tests__/fixtures/mcporter.blacklisted.json` | Config with security-blocked hosts (localhost, metadata endpoints) |
| `src/lib/agent/__tests__/fixtures/mcporter.invalid.json` | Malformed JSON for error handling tests |
| `src/lib/agent/__tests__/fixtures/mcporter.mixed.json` | Mixed valid/invalid/OAuth servers |
| `src/lib/agent/__tests__/test-utils.ts` | Test utilities for config creation and env management |
| `src/lib/agent/__tests__/mcp-server-validator.test.ts` | Comprehensive tests for config parsing and validation |

### Files Modified

| File | Changes |
|------|---------|
| `src/lib/agent/mcp-server-validator.ts` | Added environment variable support for `MCPORTER_CONFIG_PATH`, `MCPORTER_TEST_MODE`, `MCPORTER_SKIP_DNS`, `MCPORTER_SKIP_OAUTH` |

### Running the Tests

```bash
# Install vitest if not already installed
pnpm add -D vitest

# Run the validator tests
npx vitest run src/lib/agent/__tests__/mcp-server-validator.test.ts

# Run with watch mode during development
npx vitest src/lib/agent/__tests__/mcp-server-validator.test.ts
```

### Test Coverage

The test suite covers:

1. **URL Format Validation** - HTTPS/HTTP protocol checks, malformed URL rejection
2. **Hostname Blacklist** - Security checks for localhost, private networks, cloud metadata
3. **Hostname Validation** - DNS reachability and blacklist enforcement
4. **Server Address Validation** - Local command vs remote URL server handling
5. **OAuth Detection** - Explicit flags and OAuth config object detection
6. **Config File Loading** - Valid JSON, missing files, invalid JSON
7. **Server Normalization** - Multiple config formats (`mcpServers`, `servers`)
8. **Full Validation Flow** - Integration of all validators
9. **Environment Variable Overrides** - Test isolation support
10. **Dynamic Config Creation** - Runtime config generation for tests
