/**
 * Tasks Layout Route
 *
 * Acts as a parent route for all /tasks/* routes.
 * Just renders the outlet - child routes handle the actual content.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks')({
  component: TasksLayout,
})

function TasksLayout() {
  return <Outlet />
}
