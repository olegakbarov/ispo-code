/**
 * Commit Message Generator using Gemini Flash
 */

import { google } from "@ai-sdk/google"
import { generateText } from "ai"

export interface GenerateCommitMessageInput {
  /** Task title for context (optional) */
  taskTitle?: string
  /** Task description/content for additional context (optional) */
  taskDescription?: string
  /** List of changed files */
  changedFiles: string[]
  /** Git diffs for the changed files (optional but recommended) */
  diffs?: string[]
}

export interface GenerateCommitMessageResult {
  message: string
}

/**
 * Generate a conventional commit message using Gemini Flash
 * Based on task context and file changes
 */
export async function generateCommitMessage(
  input: GenerateCommitMessageInput
): Promise<GenerateCommitMessageResult> {
  const { taskTitle, taskDescription, changedFiles, diffs } = input

  // Build context prompt
  let contextPrompt = ""

  if (taskTitle) {
    contextPrompt += `Task: ${taskTitle}\n`
  }

  if (taskDescription) {
    contextPrompt += `\nDescription:\n${taskDescription}\n`
  }

  contextPrompt += `\nChanged files (${changedFiles.length}):\n`
  contextPrompt += changedFiles.map((f) => `  - ${f}`).join("\n")

  if (diffs && diffs.length > 0) {
    contextPrompt += "\n\nFile diffs:\n"
    contextPrompt += diffs.join("\n\n---\n\n")
  }

  const systemPrompt = `You are a git commit message generator. Generate concise, conventional commit messages following this format:

<type>: <subject>

<optional body>

Rules:
- Type must be one of: feat, fix, docs, style, refactor, test, chore
- Subject line should be 50 characters or less
- Use imperative mood ("add" not "added" or "adds")
- Body is optional but recommended for complex changes
- Focus on WHAT changed and WHY, not HOW
- Be specific and clear

Examples:
"feat: add user authentication with JWT"
"fix: resolve memory leak in file watcher"
"refactor: simplify git service error handling"

Generate ONLY the commit message, no explanations or markdown.`

  try {
    const result = await generateText({
      model: google("gemini-2.0-flash-exp"),
      system: systemPrompt,
      prompt: contextPrompt,
      temperature: 0.7,
    })

    return {
      message: result.text.trim(),
    }
  } catch (error) {
    throw new Error(
      `Failed to generate commit message: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
