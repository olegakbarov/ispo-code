export type TaskListAction = 'implement' | 'review'

export interface TaskListProgress {
  total: number
  done: number
}

export function getTaskListAction(progress: TaskListProgress): TaskListAction {
  if (progress.total > 0 && progress.done === progress.total) {
    return 'review'
  }
  return 'implement'
}

export function getTaskListActionTitle(action: TaskListAction): string {
  return action === 'review' ? 'Review & commit' : 'Run implementation'
}
