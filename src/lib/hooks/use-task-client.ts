import { useMemo } from "react"
import { createTRPCClient, httpLink } from "@trpc/client"
import type { AppRouter } from "@/trpc/router"
import { getWorkingDir } from "@/lib/stores/working-dir"

export function createTaskTRPCClient(taskPath: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: "/api/trpc",
        headers: () => {
          const workingDir = getWorkingDir()
          return {
            ...(workingDir ? { "X-Working-Dir": workingDir } : {}),
            "X-Task-Path": taskPath,
          }
        },
      }),
    ],
  })
}

export function useTaskTRPCClient(taskPath?: string | null) {
  return useMemo(() => {
    if (!taskPath) return null
    return createTaskTRPCClient(taskPath)
  }, [taskPath])
}
