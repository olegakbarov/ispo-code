/**
 * Tasks Index Route - /tasks
 *
 * Shows the tasks page with no task selected.
 * Handles legacy search param redirects (?path=..., ?create=1).
 */

import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { TasksPage } from './_page'
import { encodeTaskPath } from '@/lib/utils/task-routing'

export const Route = createFileRoute('/tasks/')({
  validateSearch: z
    .object({
      // Legacy search params (for redirect)
      path: z.string().optional(),
      create: z.string().optional(),
      // Preserved search params
      archiveFilter: z.enum(['all', 'active', 'archived']).optional().default('active'),
      sortBy: z.enum(['updated', 'title', 'progress']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    })
    .parse,
  beforeLoad: ({ search }) => {
    // Redirect legacy ?path=... to /tasks/<encoded-path>
    if (search.path) {
      throw redirect({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(search.path) },
        search: {
          archiveFilter: search.archiveFilter,
          sortBy: search.sortBy,
          sortDir: search.sortDir,
        },
        replace: true,
      })
    }
    // Redirect legacy ?create=1 to /tasks/new
    if (search.create === '1') {
      throw redirect({
        to: '/tasks/new',
        search: {
          archiveFilter: search.archiveFilter,
          sortBy: search.sortBy,
          sortDir: search.sortDir,
        },
        replace: true,
      })
    }
  },
  component: TasksIndex,
})

function TasksIndex() {
  const search = Route.useSearch()

  return (
    <TasksPage
      selectedPath={null}
      createModalOpen={false}
      archiveFilter={search.archiveFilter}
      sortBy={search.sortBy}
      sortDir={search.sortDir}
    />
  )
}
