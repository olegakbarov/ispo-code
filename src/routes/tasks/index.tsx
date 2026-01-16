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
    })
    .parse,
  beforeLoad: ({ search }) => {
    // Redirect legacy ?path=... to /tasks/<encoded-path>
    if (search.path) {
      throw redirect({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(search.path) },
        replace: true,
      })
    }
    // Redirect legacy ?create=1 to /tasks/new
    if (search.create === '1') {
      throw redirect({
        to: '/tasks/new',
        replace: true,
      })
    }
  },
  component: TasksIndex,
})

function TasksIndex() {
  return (
    <TasksPage
      selectedPath={null}
    />
  )
}
