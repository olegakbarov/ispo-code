/**
 * Tool Calls Route - Redirects to /settings/tool-calls
 */

import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/tool-calls")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/tool-calls" })
  },
})
