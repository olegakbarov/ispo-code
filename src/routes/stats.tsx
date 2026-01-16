/**
 * Stats Route - Redirects to /settings/stats
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/stats")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/stats" })
  },
})
