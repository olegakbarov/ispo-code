/**
 * Tasks Splat Route - /tasks/<encoded-task-path>[/edit|/review]
 *
 * Displays a specific task. The task path is URL-encoded in the splat segment.
 * Mode (edit/review) can be appended as the last segment.
 *
 * Examples:
 *   /tasks/tasks~my-feature.md -> task "tasks/my-feature.md", mode "edit"
 *   /tasks/tasks~my-feature.md/edit -> task "tasks/my-feature.md", mode "edit"
 *   /tasks/tasks~my-feature.md/review -> task "tasks/my-feature.md", mode "review"
 */

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TasksPage } from './_page'
import { decodeTaskPath } from '@/lib/utils/task-routing'

export const Route = createFileRoute('/tasks/$')({
  validateSearch: z
    .object({
      archiveFilter: z.enum(['all', 'active', 'archived']).optional().default('active'),
      sortBy: z.enum(['updated', 'title', 'progress']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    })
    .parse,
  component: TasksSplat,
})

type Mode = 'edit' | 'review' | 'debate'

function extractModeFromSplat(splat: string): { taskPath: string; mode: Mode } {
  // Check if splat ends with /edit, /review, or /debate
  if (splat.endsWith('/edit')) {
    return { taskPath: decodeTaskPath(splat.slice(0, -5)), mode: 'edit' }
  }
  if (splat.endsWith('/review')) {
    return { taskPath: decodeTaskPath(splat.slice(0, -7)), mode: 'review' }
  }
  if (splat.endsWith('/debate')) {
    return { taskPath: decodeTaskPath(splat.slice(0, -7)), mode: 'debate' }
  }
  // Default to edit mode
  return { taskPath: decodeTaskPath(splat), mode: 'edit' }
}

function TasksSplat() {
  const params = Route.useParams()
  const search = Route.useSearch()

  // Extract task path and mode from splat
  const { taskPath, mode } = params._splat
    ? extractModeFromSplat(params._splat)
    : { taskPath: null, mode: 'edit' as Mode }

  return (
    <TasksPage
      selectedPath={taskPath}
      mode={mode}
      createModalOpen={false}
      archiveFilter={search.archiveFilter}
      sortBy={search.sortBy}
      sortDir={search.sortDir}
    />
  )
}
