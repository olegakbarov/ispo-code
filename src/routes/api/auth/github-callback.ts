/**
 * GitHub OAuth callback endpoint
 * Handles authorization code exchange and session creation
 */

import { createFileRoute } from "@tanstack/react-router"
import { exchangeCodeForToken, getGitHubUser } from "@/lib/auth/github-oauth"
import { getSession } from "@/lib/auth/session-store"

export const Route = createFileRoute("/api/auth/github-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const error = url.searchParams.get("error")

        // Handle OAuth errors
        if (error) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=${encodeURIComponent(error)}`,
            },
          })
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/?error=missing_code",
            },
          })
        }

        try {
          // Exchange code for access token
          const accessToken = await exchangeCodeForToken(code)

          // Fetch user profile
          const user = await getGitHubUser(accessToken)

          // Create response to set cookie
          const response = new Response(null, {
            status: 302,
            headers: {
              Location: "/",
            },
          })

          // Store session data
          const session = await getSession(request, response)
          session.userId = user.id
          session.githubToken = accessToken
          session.username = user.login
          session.avatarUrl = user.avatar_url
          await session.save()

          return response
        } catch (err) {
          console.error("OAuth callback error:", err)
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/?error=auth_failed`,
            },
          })
        }
      },
    },
  },
})
