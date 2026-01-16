import { describe, it, expect } from 'vitest'
import { getCreateTaskRenderMode } from './create-task-visibility'

describe('getCreateTaskRenderMode', () => {
  it('returns modal when create modal is open without a selected task', () => {
    expect(getCreateTaskRenderMode({ selectedPath: null, isCreateModalOpen: true })).toBe('modal')
  })

  it('returns modal when create modal is open with a selected task', () => {
    expect(getCreateTaskRenderMode({ selectedPath: 'tasks/example.md', isCreateModalOpen: true })).toBe('modal')
  })

  it('returns inline when no task is selected and modal is closed', () => {
    expect(getCreateTaskRenderMode({ selectedPath: null, isCreateModalOpen: false })).toBe('inline')
  })

  it('returns none when a task is selected and modal is closed', () => {
    expect(getCreateTaskRenderMode({ selectedPath: 'tasks/example.md', isCreateModalOpen: false })).toBe('none')
  })
})
