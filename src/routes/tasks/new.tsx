/**
 * Tasks New Route - /tasks/new
 *
 * Opens the tasks page with the create modal open.
 */

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TasksPage } from './_page'

export const Route = createFileRoute('/tasks/new')({
  validateSearch: z
    .object({
      archiveFilter: z.enum(['all', 'active', 'archived']).optional().default('active'),
      sortBy: z.enum(['updated', 'title', 'progress']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    })
    .parse,
  component: TasksNew,
})

function TasksNew() {
  const search = Route.useSearch()

  return (
    <TasksPage
      selectedPath={null}
      createModalOpen={true}
      archiveFilter={search.archiveFilter}
      sortBy={search.sortBy}
      sortDir={search.sortDir}
    />
  )
}
