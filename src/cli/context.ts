/**
 * CLI Context - shared state and utilities for all commands
 */

import { appRouter } from "../trpc/router"
import { createCallerFactory } from "../trpc/trpc"
import { createContext } from "../trpc/context"
import { StreamAPI } from "../streams/client"
import type { inferRouterOutputs } from "@trpc/server"

const createCaller = createCallerFactory(appRouter)

export type TRPCCaller = ReturnType<typeof createCaller>
export type RouterOutputs = inferRouterOutputs<typeof appRouter>

export interface CLIConfig {
  port: number
  host: string
  open: boolean
  workingDir: string
}

export interface CLIContext {
  trpc: TRPCCaller
  streams: StreamAPI
  config: CLIConfig
}

/**
 * Create a direct tRPC caller that doesn't go through HTTP
 */
export function createTRPCCaller(workingDir: string): TRPCCaller {
  const contextFn = createContext({ workingDir })
  return createCaller(contextFn)
}

/**
 * Create the full CLI context
 */
export function createCLIContext(config: CLIConfig): CLIContext {
  const trpc = createTRPCCaller(config.workingDir)
  const streams = new StreamAPI()

  return {
    trpc,
    streams,
    config,
  }
}
