/**
 * Server-side session management using iron-session
 * Sessions stored in httpOnly cookies for security
 */

import { getIronSession, type IronSession } from "iron-session"
import { ensureServerEnv } from "@/lib/server/env"

ensureServerEnv()

export interface SessionData {
  userId?: string
  githubToken?: string
  username?: string
  avatarUrl?: string
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long",
  cookieName: "ispo_code_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

/**
 * Get or create session from request/response
 */
export async function getSession(
  request: Request,
  response?: Response
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(request, response ?? new Response(), sessionOptions)
}

/**
 * Clear session data
 */
export async function clearSession(request: Request, response?: Response): Promise<void> {
  const session = await getSession(request, response)
  session.destroy()
}
