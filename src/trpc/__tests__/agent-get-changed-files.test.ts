import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AgentSessionMetadata, EditedFileInfo } from "@/lib/agent/types"
import { agentRouter } from "@/trpc/agent"

let registryEvents: unknown[] = []
let readSessionMock = vi.fn()

vi.mock("@/streams/client", () => ({
  getStreamAPI: () => ({
    readRegistry: async () => registryEvents,
    readSession: (...args: unknown[]) => readSessionMock(...args),
  }),
}))

function buildMetadata(editedFiles: EditedFileInfo[]): AgentSessionMetadata {
  return {
    contextWindow: {
      estimatedTokens: 0,
      modelLimit: 200_000,
      utilizationPercent: 0,
    },
    editedFiles,
    toolStats: {
      totalCalls: 0,
      byTool: {},
      byType: {
        read: 0,
        write: 0,
        execute: 0,
        other: 0,
      },
    },
    outputMetrics: {
      textChunks: 0,
      thinkingChunks: 0,
      errorChunks: 0,
      systemChunks: 0,
      totalCharacters: 0,
      estimatedOutputTokens: 0,
    },
    duration: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
    messageCount: 0,
  }
}

beforeEach(() => {
  registryEvents = []
  readSessionMock = vi.fn()
})

describe("agent.getChangedFiles", () => {
  it("returns metadata editedFiles without reading session stream", async () => {
    const sessionId = "session-1"
    const workingDir = process.cwd()
    const editedFiles: EditedFileInfo[] = [
      {
        path: `${workingDir}/foo.txt`,
        relativePath: "foo.txt",
        repoRelativePath: "foo.txt",
        operation: "edit",
        timestamp: "2026-01-01T00:00:00Z",
        toolUsed: "write_file",
      },
    ]

    registryEvents = [
      {
        type: "session_created",
        sessionId,
        agentType: "codex",
        prompt: "Test",
        workingDir,
        timestamp: "2026-01-01T00:00:00Z",
      },
      {
        type: "session_completed",
        sessionId,
        metadata: buildMetadata(editedFiles),
        timestamp: "2026-01-01T00:10:00Z",
      },
    ]

    readSessionMock.mockImplementation(() => {
      throw new Error("readSession should not be called")
    })

    const caller = agentRouter.createCaller({ workingDir })
    const result = await caller.getChangedFiles({ sessionId })

    expect(result).toEqual(editedFiles)
    expect(readSessionMock).not.toHaveBeenCalled()
  })

  it("falls back to parsing tool_use chunks when metadata is missing", async () => {
    const sessionId = "session-2"
    const workingDir = process.cwd()
    const filePath = `${workingDir}/bar.txt`

    registryEvents = [
      {
        type: "session_created",
        sessionId,
        agentType: "codex",
        prompt: "Test",
        workingDir,
        timestamp: "2026-01-02T00:00:00Z",
      },
    ]

    readSessionMock.mockResolvedValue([
      {
        type: "output",
        chunk: {
          type: "tool_use",
          content: JSON.stringify({
            name: "write_file",
            input: { path: filePath },
          }),
          timestamp: "2026-01-02T00:01:00Z",
        },
        timestamp: "2026-01-02T00:01:00Z",
      },
    ])

    const caller = agentRouter.createCaller({ workingDir })
    const result = await caller.getChangedFiles({ sessionId })

    expect(readSessionMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(filePath)
    expect(result[0].relativePath).toBe("bar.txt")
    expect(result[0].operation).toBe("edit")
    expect(result[0].toolUsed).toBe("write_file")
  })
})
