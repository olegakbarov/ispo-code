/**
 * tRPC initialization - router and procedure setup
 */

import { initTRPC } from "@trpc/server"
import type { Context } from "./context"
import { trpcLogger } from "@/lib/logger"

const t = initTRPC.context<Context>().create()

/**
 * Logging middleware - logs procedure entry, exit, errors, and duration
 */
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const timer = trpcLogger.startTimer(path)
  const sessionInfo = ctx.sessionId ? ` [session:${ctx.sessionId.slice(0, 8)}]` : ''

  trpcLogger.info(path, `${type} started${sessionInfo}`)

  try {
    const result = await next()

    if (result.ok) {
      timer.end(`${type} completed${sessionInfo}`)
    } else {
      timer.endWithError(`${type} failed${sessionInfo}`, result.error)
    }

    return result
  } catch (error) {
    timer.endWithError(`${type} threw${sessionInfo}`, error)
    throw error
  }
})

export const router = t.router
/** Standard procedure with logging middleware */
export const procedure = t.procedure.use(loggingMiddleware)
/** Public procedure with logging middleware */
export const publicProcedure = t.procedure.use(loggingMiddleware)
export const createCallerFactory = t.createCallerFactory
