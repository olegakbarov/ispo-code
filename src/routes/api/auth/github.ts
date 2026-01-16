/**
 * GitHub OAuth login endpoint
 * Redirects to GitHub authorization page
 */

import { createFileRoute } from "@tanstack/react-router"
import { getAuthorizationUrl } from "@/lib/auth/github-oauth"

export const Route = createFileRoute("/api/auth/github")({
  server: {
    handlers: {
      GET: async () => {
        const authUrl = getAuthorizationUrl()
        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
          },
        })
      },
    },
  },
})
