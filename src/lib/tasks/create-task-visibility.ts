export type CreateTaskRenderMode = 'inline' | 'modal' | 'none'

interface CreateTaskVisibilityState {
  selectedPath: string | null
  isCreateModalOpen: boolean
}

export function getCreateTaskRenderMode({
  selectedPath,
  isCreateModalOpen,
}: CreateTaskVisibilityState): CreateTaskRenderMode {
  if (isCreateModalOpen) return 'modal'
  if (!selectedPath) return 'inline'
  return 'none'
}
