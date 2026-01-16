import { describe, it, expect } from 'vitest'
import { buildTaskVerifyPrompt } from './verify-prompt'

describe('buildTaskVerifyPrompt', () => {
  const baseParams = {
    taskPath: 'tasks/test-task.md',
    taskContent: '# Test Task\n\n- [x] Item 1\n- [ ] Item 2',
    workingDir: '/test/project',
  }

  it('includes mandatory test run instruction', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain('MANDATORY: Run Tests First')
    expect(prompt).toContain('MUST run the project\'s test suite')
    expect(prompt).toContain('non-negotiable')
  })

  it('includes test command discovery instructions', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain('Read `package.json` scripts section')
    expect(prompt).toContain('npm run test:run')
    expect(prompt).toContain('npm test')
    expect(prompt).toContain('bun test')
  })

  it('requires test results in output', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain('Test Results Required')
    expect(prompt).toContain('MUST include test results in your verification output')
  })

  it('prioritizes running tests first in verification steps', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    // Tests should be listed first in the mission section
    expect(prompt).toContain('1. **Run tests FIRST**')
  })

  it('requires test results in output format', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain('## Verification Results')
    expect(prompt).toContain('**Test Results**: Pass/Fail with summary')
  })

  it('includes example test output format', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain('### Test Results')
    expect(prompt).toContain('✓ All 45 tests passed (npm run test:run)')
  })

  it('includes context paths correctly', () => {
    const prompt = buildTaskVerifyPrompt(baseParams)

    expect(prompt).toContain(baseParams.workingDir)
    expect(prompt).toContain(baseParams.taskPath)
    expect(prompt).toContain(baseParams.taskContent)
  })

  it('includes additional instructions when provided', () => {
    const prompt = buildTaskVerifyPrompt({
      ...baseParams,
      instructions: 'Focus on security review',
    })

    expect(prompt).toContain('## Additional Verification Instructions')
    expect(prompt).toContain('Focus on security review')
  })
})
