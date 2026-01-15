import { describe, it, expect } from "vitest"
import { sessionTrpcOptions } from "./trpc-session"

describe("sessionTrpcOptions", () => {
  it("returns trpc context when sessionId is provided", () => {
    expect(sessionTrpcOptions("abc123")).toEqual({
      trpc: {
        context: { sessionId: "abc123" },
      },
    })
  })

  it("returns empty options when sessionId is missing", () => {
    expect(sessionTrpcOptions()).toEqual({})
  })
})
