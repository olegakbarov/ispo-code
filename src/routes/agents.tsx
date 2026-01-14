/**
 * Agents Layout - Parent route for agent-related pages
 *
 * This is a layout component that wraps nested agent routes:
 * - /agents/ -> redirects to /
 * - / -> create new agent session
 * - /agents/$sessionId -> view existing session
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/agents")({
  component: AgentsLayout,
})

function AgentsLayout() {
  return <Outlet />
}
