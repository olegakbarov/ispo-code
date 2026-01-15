import { describe, it, expect } from "vitest"
import { createRegistryEvent } from "../../streams/schemas"
import { resolveTaskSessionIdsFromRegistry } from "./task-session"

const createdEvent = (sessionId: string, taskPath?: string) =>
  createRegistryEvent.created({
    sessionId,
    agentType: "claude",
    prompt: "test",
    workingDir: "/tmp",
    taskPath,
  })

describe("resolveTaskSessionIdsFromRegistry", () => {
  it("prefers direct task sessions over splitFrom", () => {
    const events = [
      createdEvent("direct", "tasks/new-task.md"),
      createdEvent("split", "tasks/original-task.md"),
    ]

    expect(resolveTaskSessionIdsFromRegistry(events, "tasks/new-task.md", "tasks/original-task.md")).toEqual(["direct"])
  })

  it("falls back to splitFrom when direct sessions are missing", () => {
    const events = [createdEvent("split", "tasks/original-task.md")]

    expect(resolveTaskSessionIdsFromRegistry(events, "tasks/new-task.md", "tasks/original-task.md")).toEqual(["split"])
  })

  it("falls back from archived splitFrom to base task path", () => {
    const events = [createdEvent("split", "tasks/original-task.md")]

    expect(
      resolveTaskSessionIdsFromRegistry(
        events,
        "tasks/new-task.md",
        "tasks/archive/2026-01/original-task.md"
      )
    ).toEqual(["split"])
  })
})
