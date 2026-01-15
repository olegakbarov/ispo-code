import { describe, it, expect } from 'vitest'
import { getTaskListAction, getTaskListActionTitle } from './task-list-action'

describe('getTaskListAction', () => {
  it('returns implement when there is no checklist', () => {
    expect(getTaskListAction({ total: 0, done: 0 })).toBe('implement')
  })

  it('returns implement when partially complete', () => {
    expect(getTaskListAction({ total: 5, done: 2 })).toBe('implement')
  })

  it('returns review when all items are complete', () => {
    expect(getTaskListAction({ total: 3, done: 3 })).toBe('review')
  })
})

describe('getTaskListActionTitle', () => {
  it('returns implementation label for implement action', () => {
    expect(getTaskListActionTitle('implement')).toBe('Run implementation')
  })

  it('returns review label for review action', () => {
    expect(getTaskListActionTitle('review')).toBe('Review & commit')
  })
})
