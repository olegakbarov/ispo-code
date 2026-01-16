/**
 * Tasks New Route - /tasks/new
 *
 * Redirects to /tasks (index) where the inline create form is shown.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks/new')({
  beforeLoad: () => {
    throw redirect({
      to: '/tasks/',
      replace: true,
    })
  },
})
