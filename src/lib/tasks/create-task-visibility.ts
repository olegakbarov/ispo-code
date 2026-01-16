export type CreateTaskRenderMode = 'inline' | 'none'

interface CreateTaskVisibilityState {
  selectedPath: string | null
}

export function getCreateTaskRenderMode({
  selectedPath,
}: CreateTaskVisibilityState): CreateTaskRenderMode {
  if (!selectedPath) return 'inline'
  return 'none'
}
