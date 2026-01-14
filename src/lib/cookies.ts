/**
 * Cookie utility functions for client-side cookie management
 */

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null
  }

  return null
}

/**
 * Set a cookie value
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number
    path?: string
    sameSite?: "strict" | "lax" | "none"
    secure?: boolean
  } = {}
): void {
  if (typeof document === "undefined") return

  const {
    maxAge = 31536000, // 1 year default
    path = "/",
    sameSite = "lax",
    secure = false,
  } = options

  let cookieString = `${name}=${value}; path=${path}; SameSite=${sameSite}`

  if (maxAge) {
    cookieString += `; max-age=${maxAge}`
  }

  if (secure) {
    cookieString += "; Secure"
  }

  document.cookie = cookieString
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string, path: string = "/"): void {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; path=${path}; max-age=0`
}
