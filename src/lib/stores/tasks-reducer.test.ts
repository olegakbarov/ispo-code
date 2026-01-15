import { describe, it, expect } from "vitest"
import { tasksReducer, initialTasksState } from "./tasks-reducer"

describe("tasksReducer pending commit state", () => {
  it("stores pending commit messages per task path", () => {
    const withFirst = tasksReducer(initialTasksState, {
      type: "SET_PENDING_COMMIT_MESSAGE",
      payload: { path: "tasks/alpha.md", message: "feat: add alpha" },
    })

    const withSecond = tasksReducer(withFirst, {
      type: "SET_PENDING_COMMIT_MESSAGE",
      payload: { path: "tasks/beta.md", message: "fix: update beta" },
    })

    expect(withSecond.pendingCommit["tasks/alpha.md"]?.message).toBe("feat: add alpha")
    expect(withSecond.pendingCommit["tasks/beta.md"]?.message).toBe("fix: update beta")
  })

  it("resets a single task without clearing others", () => {
    const withFirst = tasksReducer(initialTasksState, {
      type: "SET_PENDING_COMMIT_MESSAGE",
      payload: { path: "tasks/alpha.md", message: "feat: add alpha" },
    })

    const withSecond = tasksReducer(withFirst, {
      type: "SET_PENDING_COMMIT_MESSAGE",
      payload: { path: "tasks/beta.md", message: "fix: update beta" },
    })

    const resetFirst = tasksReducer(withSecond, {
      type: "RESET_PENDING_COMMIT",
      payload: { path: "tasks/alpha.md" },
    })

    expect(resetFirst.pendingCommit["tasks/alpha.md"]).toBeUndefined()
    expect(resetFirst.pendingCommit["tasks/beta.md"]?.message).toBe("fix: update beta")
  })
})
