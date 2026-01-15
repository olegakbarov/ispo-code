/**
 * Root tRPC Router
 */

import { router } from "./trpc"
import { gitRouter } from "./git"
import { agentRouter } from "./agent"
import { tasksRouter } from "./tasks"
import { systemRouter } from "./system"
import { debateRouter } from "./debate"

export const appRouter = router({
  git: gitRouter,
  agent: agentRouter,
  tasks: tasksRouter,
  system: systemRouter,
  debate: debateRouter,
})

export type AppRouter = typeof appRouter
