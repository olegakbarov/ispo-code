/**
 * Root tRPC Router
 */

import { router } from "./trpc"
import { gitRouter } from "./git"
import { agentRouter } from "./agent"
import { tasksRouter } from "./tasks"
import { systemRouter } from "./system"

export const appRouter = router({
  git: gitRouter,
  agent: agentRouter,
  tasks: tasksRouter,
  system: systemRouter,
})

export type AppRouter = typeof appRouter
