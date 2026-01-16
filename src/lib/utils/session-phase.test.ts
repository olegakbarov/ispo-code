/**
 * Session Phase Utilities Tests
 */

import { describe, it, expect } from "vitest"
import { getPhaseFromSessionTitle } from "./session-phase"

describe("getPhaseFromSessionTitle", () => {
  it("returns Planning for Plan: prefix", () => {
    expect(getPhaseFromSessionTitle("Plan: Add dark mode")).toBe("Planning")
    expect(getPhaseFromSessionTitle("Plan: Fix bug in login")).toBe("Planning")
  })

  it("returns Debugging for Debug: prefix", () => {
    expect(getPhaseFromSessionTitle("Debug: Fix login bug")).toBe("Debugging")
    expect(getPhaseFromSessionTitle("Debug: Investigate memory leak")).toBe("Debugging")
  })

  it("returns Implementation for Run: prefix", () => {
    expect(getPhaseFromSessionTitle("Run: Add dark mode")).toBe("Implementation")
    expect(getPhaseFromSessionTitle("Run: Implement feature")).toBe("Implementation")
  })

  it("returns Review for Review: prefix", () => {
    expect(getPhaseFromSessionTitle("Review: Add dark mode")).toBe("Review")
    expect(getPhaseFromSessionTitle("Review: Check implementation")).toBe("Review")
  })

  it("returns Verification for Verify: prefix", () => {
    expect(getPhaseFromSessionTitle("Verify: Add dark mode")).toBe("Verification")
    expect(getPhaseFromSessionTitle("Verify: Test implementation")).toBe("Verification")
  })

  it("returns undefined for unrecognized prefixes", () => {
    expect(getPhaseFromSessionTitle("Custom: Some task")).toBeUndefined()
    expect(getPhaseFromSessionTitle("Other: Task name")).toBeUndefined()
    expect(getPhaseFromSessionTitle("Orchestrator: Main task")).toBeUndefined()
  })

  it("returns undefined for titles without colon", () => {
    expect(getPhaseFromSessionTitle("No colon in title")).toBeUndefined()
    expect(getPhaseFromSessionTitle("Simple task name")).toBeUndefined()
  })

  it("returns undefined for empty or undefined input", () => {
    expect(getPhaseFromSessionTitle("")).toBeUndefined()
    expect(getPhaseFromSessionTitle(undefined)).toBeUndefined()
  })

  it("handles prefix with extra whitespace around the prefix", () => {
    // Both leading and trailing spaces around the prefix are handled by trim()
    expect(getPhaseFromSessionTitle("Plan : Add feature")).toBe("Planning") // trim() handles trailing space
    expect(getPhaseFromSessionTitle(" Plan: Add feature")).toBe("Planning") // trim() handles leading space
  })

  it("is case-sensitive for prefixes", () => {
    expect(getPhaseFromSessionTitle("plan: lowercase")).toBeUndefined()
    expect(getPhaseFromSessionTitle("PLAN: uppercase")).toBeUndefined()
    expect(getPhaseFromSessionTitle("Plan: correct case")).toBe("Planning")
  })
})
