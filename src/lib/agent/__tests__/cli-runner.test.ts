/**
 * CLI runner availability tests
 *
 * Run with: npx vitest run src/lib/agent/__tests__/cli-runner.test.ts
 */

import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getAvailableAgentTypes } from '../cli-runner'
import { withTempConfig, setupTestEnvCustom } from './test-utils'

describe('getAvailableAgentTypes', () => {
  it('includes mcporter when MCPORTER_CONFIG_PATH is set and Gemini key is present', () => {
    const previousHome = process.env.HOME
    const tempHome = mkdtempSync(join(tmpdir(), 'mcporter-home-'))

    const { path, cleanup } = withTempConfig({
      servers: {
        'mock-qa': {
          description: 'Mock QA server',
          command: 'node',
          args: ['-e', 'console.log("ok")'],
        },
      },
    })

    const cleanupEnv = setupTestEnvCustom({ configPath: path })
    const previousGeminiKey = process.env.GEMINI_API_KEY
    process.env.HOME = tempHome
    process.env.GEMINI_API_KEY = 'test-key'

    try {
      const types = getAvailableAgentTypes()
      expect(types).toContain('mcporter')
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
      if (previousGeminiKey === undefined) {
        delete process.env.GEMINI_API_KEY
      } else {
        process.env.GEMINI_API_KEY = previousGeminiKey
      }
      cleanupEnv()
      cleanup()
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
})
