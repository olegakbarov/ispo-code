/**
 * Worktrees Route - Redirects to /settings/worktrees
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/worktrees")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/worktrees" })
  },
})
