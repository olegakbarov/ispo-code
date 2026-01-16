/**
 * User menu - clickable control that navigates to settings
 */

import { Link } from "@tanstack/react-router"
import { Settings } from "lucide-react"
import { trpc } from "@/lib/trpc-client"

export function UserMenu() {
  const { data: session } = trpc.github.getSession.useQuery()

  if (!session?.authenticated || !session.username) {
    return null
  }

  return (
    <Link
      to="/settings"
      className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-secondary transition-colors group"
    >
      {/* Avatar */}
      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm shrink-0">
        {session.username[0].toUpperCase()}
      </div>

      {/* Username */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{session.username}</div>
        <div className="text-[10px] text-muted-foreground">Account settings</div>
      </div>

      {/* Settings icon */}
      <Settings className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  )
}
