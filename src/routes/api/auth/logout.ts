/**
 * Logout endpoint
 * Destroys session and redirects to home
 */

import { createFileRoute } from "@tanstack/react-router"
import { clearSession } from "@/lib/auth/session-store"

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: "/",
          },
        })

        await clearSession(request, response)
        return response
      },
    },
  },
})
