import { z } from "zod"

export const LogLineSchema = z.object({
  t: z.union([z.number(), z.string(), z.null()]).optional(),
  level: z.string().default("info"),
  msg: z.string(),
  url: z.string().optional(),
  lineNumber: z.number().optional(),
  columnNumber: z.number().optional(),
  data: z.any().optional(),
})

export const LogBatchSchema = z.union([LogLineSchema, z.array(LogLineSchema)])

export type LogLine = z.infer<typeof LogLineSchema>
export type LogBatch = z.infer<typeof LogBatchSchema>
