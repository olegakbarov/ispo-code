/**
 * GitHub OAuth flow helpers
 */

import { ensureServerEnv, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI } from "@/lib/server/env"

ensureServerEnv()

export interface GitHubUser {
  id: string
  login: string
  name: string
  email: string
  avatar_url: string
}

export interface GitHubAccessTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "repo,user:email",
    state: state || Math.random().toString(36).substring(7),
  })

  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.statusText}`)
  }

  const data: GitHubAccessTokenResponse = await response.json()
  return data.access_token
}

/**
 * Fetch authenticated user's GitHub profile
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`)
  }

  const user = await response.json()
  return {
    id: user.id.toString(),
    login: user.login,
    name: user.name || user.login,
    email: user.email || "",
    avatar_url: user.avatar_url,
  }
}
