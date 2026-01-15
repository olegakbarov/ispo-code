import { describe, it, expect } from "vitest"
import { createRegistryEvent } from "../../streams/schemas"
import { resolveTaskSessionIdsFromRegistry, getActiveSessionIdsForTask } from "./task-session"

const createdEvent = (sessionId: string, taskPath?: string) =>
  createRegistryEvent.created({
    sessionId,
    agentType: "claude",
    prompt: "test",
    workingDir: "/tmp",
    taskPath,
  })

const deletedEvent = (sessionId: string) =>
  createRegistryEvent.deleted({ sessionId })

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

describe("getActiveSessionIdsForTask", () => {
  it("returns direct task sessions", () => {
    const events = [
      createdEvent("session1", "tasks/my-task.md"),
      createdEvent("session2", "tasks/my-task.md"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual(["session1", "session2"])
  })

  it("includes subtask sessions (taskPath#subtaskId)", () => {
    const events = [
      createdEvent("parent", "tasks/my-task.md"),
      createdEvent("subtask1", "tasks/my-task.md#abc123"),
      createdEvent("subtask2", "tasks/my-task.md#def456"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual([
      "parent",
      "subtask1",
      "subtask2",
    ])
  })

  it("excludes deleted sessions", () => {
    const events = [
      createdEvent("active", "tasks/my-task.md"),
      createdEvent("deleted", "tasks/my-task.md"),
      deletedEvent("deleted"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual(["active"])
  })

  it("excludes deleted subtask sessions", () => {
    const events = [
      createdEvent("parent", "tasks/my-task.md"),
      createdEvent("subtask-active", "tasks/my-task.md#abc"),
      createdEvent("subtask-deleted", "tasks/my-task.md#def"),
      deletedEvent("subtask-deleted"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual([
      "parent",
      "subtask-active",
    ])
  })

  it("returns empty array when all sessions are deleted", () => {
    const events = [
      createdEvent("session1", "tasks/my-task.md"),
      createdEvent("session2", "tasks/my-task.md"),
      deletedEvent("session1"),
      deletedEvent("session2"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual([])
  })

  it("falls back to splitFrom for active sessions", () => {
    const events = [
      createdEvent("split-session", "tasks/original.md"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/new.md", "tasks/original.md")).toEqual([
      "split-session",
    ])
  })

  it("excludes deleted splitFrom sessions", () => {
    const events = [
      createdEvent("split-active", "tasks/original.md"),
      createdEvent("split-deleted", "tasks/original.md"),
      deletedEvent("split-deleted"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/new.md", "tasks/original.md")).toEqual([
      "split-active",
    ])
  })

  it("returns empty array when no sessions match", () => {
    const events = [
      createdEvent("other", "tasks/other-task.md"),
    ]

    expect(getActiveSessionIdsForTask(events, "tasks/my-task.md")).toEqual([])
  })
})
