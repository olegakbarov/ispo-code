/**
 * Root tRPC Router
 */

import { router } from "./trpc"
import { gitRouter } from "./git"
import { agentRouter } from "./agent"
import { tasksRouter } from "./tasks"
import { systemRouter } from "./system"
import { debateRouter } from "./debate"
import { audioRouter } from "./audio"

export const appRouter = router({
  git: gitRouter,
  agent: agentRouter,
  tasks: tasksRouter,
  system: systemRouter,
  debate: debateRouter,
  audio: audioRouter,
})

export type AppRouter = typeof appRouter
