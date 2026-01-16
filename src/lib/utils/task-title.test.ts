/**
 * Task Title Utilities Tests
 */

import { describe, it, expect } from "vitest"
import { getFirstWords, getTaskSnippet } from "./task-title"

describe("getFirstWords", () => {
  it("extracts first N words from a title", () => {
    expect(getFirstWords("one two three four five six", 5)).toBe(
      "one two three four five"
    )
  })

  it("returns full title if shorter than word count", () => {
    expect(getFirstWords("one two", 5)).toBe("one two")
  })

  it("handles empty string", () => {
    expect(getFirstWords("", 5)).toBe("")
  })

  it("handles whitespace-only string", () => {
    expect(getFirstWords("   ", 5)).toBe("")
  })

  it("strips markdown bold formatting", () => {
    expect(getFirstWords("**bold** text here", 3)).toBe("bold text here")
    expect(getFirstWords("__bold__ text here", 3)).toBe("bold text here")
  })

  it("strips markdown italic formatting", () => {
    expect(getFirstWords("*italic* text here", 3)).toBe("italic text here")
    expect(getFirstWords("_italic_ text here", 3)).toBe("italic text here")
  })

  it("strips inline code backticks", () => {
    expect(getFirstWords("fix `console.log` statement here", 4)).toBe(
      "fix console.log statement here"
    )
  })

  it("strips markdown links", () => {
    expect(getFirstWords("see [documentation](http://example.com) for details", 4)).toBe(
      "see documentation for details"
    )
  })

  it("removes hash symbols", () => {
    expect(getFirstWords("# heading one two three", 3)).toBe(
      "heading one two"
    )
  })

  it("handles mixed markdown formatting", () => {
    expect(
      getFirstWords("**audio** notification should specify _which_ task", 5)
    ).toBe("audio notification should specify which")
  })

  it("handles multiple spaces between words", () => {
    expect(getFirstWords("one  two   three    four", 3)).toBe("one two three")
  })

  it("uses custom word count", () => {
    expect(getFirstWords("one two three four five", 3)).toBe("one two three")
    expect(getFirstWords("one two three four five", 1)).toBe("one")
  })
})

describe("getTaskSnippet", () => {
  it("returns first 10 words by default", () => {
    expect(
      getTaskSnippet("audio notification should specify which task has been completed failed say first five words")
    ).toBe("audio notification should specify which task has been completed failed")
  })

  it("returns full title if less than 10 words", () => {
    expect(getTaskSnippet("fix bug")).toBe("fix bug")
    expect(getTaskSnippet("audio notification should specify which")).toBe(
      "audio notification should specify which"
    )
  })

  it("handles markdown formatting", () => {
    expect(
      getTaskSnippet("**implement** new _feature_ for `users` and more words here now")
    ).toBe("implement new feature for users and more words here now")
  })

  it("handles empty title", () => {
    expect(getTaskSnippet("")).toBe("")
  })
})
