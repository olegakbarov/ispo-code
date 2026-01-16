/**
 * Agents Layout Route
 *
 * Acts as a parent route for all /agents/* routes.
 * Just renders the outlet - child routes handle the actual content.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/agents')({
  component: AgentsLayout,
})

function AgentsLayout() {
  return <Outlet />
}
