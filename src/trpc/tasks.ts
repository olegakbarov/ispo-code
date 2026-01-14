/**
 * Tasks tRPC Router
 *
 * Tasks are markdown files stored in the repo (see task-service).
 */

import { z } from "zod"
import { randomBytes } from "crypto"
import { router, procedure } from "./trpc"
import { createTask, deleteTask, getTask, listTasks, saveTask } from "@/lib/agent/task-service"
import { getProcessMonitor } from "@/daemon/process-monitor"
import { getStreamServerUrl } from "@/streams/server"
import type { SessionStatus } from "@/lib/agent/types"

/**
 * System prompt for task expansion agent.
 * The agent receives the user's prompt and generates a detailed task plan.
 */
function buildTaskExpansionPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
}): string {
  return `Task planning agent. Convert brief description into concise, actionable plan.

## Task
"${params.title}"

## Instructions
1. Explore codebase for context
2. Write plan to: ${params.taskPath}

## Format

\`\`\`markdown
# ${params.title}

## Problem Statement
What & why (2-3 sentences max)

## Scope
**In:** bullet list
**Out:** bullet list

## Implementation Plan

### Phase: [Name]
- [ ] Action (one clear step, no elaboration)
- [ ] Action

## Key Files
- \`path/file.ts\` - changes needed

## Success Criteria
- [ ] Measurable outcome
\`\`\`

## Rules (CRITICAL)
- **BE CONCISE** - Follow CLAUDE.md style: sacrifice grammar for concision
- Use fragments, not full sentences
- No marketing language or filler
- Each checkbox: one action, no elaboration
- Specific file paths, no vague terms
- Working dir: ${params.workingDir}

Explore codebase, write terse plan.`
}

/**
 * System prompt for task execution agent.
 * The agent receives an existing task plan and executes it.
 */
function buildTaskExecutionPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
}): string {
  return `You are a coding assistant. Your job is to execute a task plan that has been prepared for you.

## Task Plan

The following task plan is stored at: ${params.taskPath}

---
${params.taskContent}
---

## Instructions

1. Read and understand the task plan above
2. Execute each step in the implementation plan
3. Check off completed items by changing \`- [ ]\` to \`- [x]\` in the task file
4. Update the task file as you make progress
5. If you encounter issues, add notes to the task file

## Working Directory

All work should be done in: ${params.workingDir}

## Progress Tracking

As you complete each step:
1. Make the code changes
2. Update ${params.taskPath} to mark the step as done: \`- [x]\`
3. Add any notes or findings to the task file

Begin executing the task plan now.`
}

/**
 * System prompt for spec review agent.
 * Reviews the quality of the task specification itself (not the codebase).
 */
function buildTaskSpecReviewPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  instructions?: string
}): string {
  const userInstructions = params.instructions?.trim()
    ? `\n## Additional Review Instructions\n${params.instructions.trim()}\n`
    : ""

  return `You are a senior engineering lead reviewing a TASK SPECIFICATION. Your job is to assess the quality of this spec and suggest improvements.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## Current Task Content

${params.taskContent}

## Review Criteria

Evaluate this spec against these criteria:

1. **Clarity** - Is each item unambiguous? Could someone else understand exactly what to do?
2. **Completeness** - Are there missing steps? Edge cases not considered?
3. **Actionability** - Can each checkbox item be completed in a single work session?
4. **Scope** - Is the scope well-defined? Are boundaries clear?
5. **Dependencies** - Are prerequisites and dependencies documented?
6. **Testability** - Can success be objectively measured?

## What to Look For

- Vague language ("improve", "clean up", "handle better")
- Missing error handling or edge cases
- Steps that are too large and should be broken down
- Unclear success criteria
- Missing context that an implementer would need
- Assumptions that should be made explicit
${userInstructions}
## Output

Provide a brief review with:
1. Overall assessment (1-2 sentences)
2. Specific issues found (bulleted list)
3. Suggested improvements (bulleted list)

Keep feedback constructive and actionable. Focus on the top 3-5 most impactful issues.`
}

/**
 * System prompt for task verification agent.
 * The agent can use tools to verify that completed items are actually done.
 */
function buildTaskVerifyPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  instructions?: string
}): string {
  const userInstructions = params.instructions?.trim()
    ? `\n## Additional Verification Instructions\n${params.instructions.trim()}\n`
    : ""

  return `You are a senior engineering lead performing a VERIFICATION REVIEW. Your job is to verify that completed items (\`- [x]\`) are truly finished and identify any issues.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## Your Mission

**VERIFY** each completed checkbox item by actually checking the codebase:

1. **For code changes**: Read the referenced files and verify the code exists and looks correct
2. **For tests**: Run the test suite to verify tests pass (use \`npm test\`, \`bun test\`, etc.)
3. **For file creation**: Verify the files exist using glob/read
4. **For bug fixes**: Check that the fix is in place and makes sense
5. **For refactors**: Verify the new structure is correct

## Verification Process

For EACH completed item (\`- [x]\`):
1. Determine what evidence would prove it's done
2. Use tools to check for that evidence:
   - \`read\` - Read files to verify code changes
   - \`glob\` - Find files by pattern
   - \`grep\` - Search for code patterns
   - \`bash\` - Run tests or other verification commands
3. Mark your finding in the output

## What to Check

- **Completed items are ACTUALLY done** - not just checked off
- **Code quality** - no obvious bugs, edge cases handled
- **Tests pass** - if tests are mentioned, run them
- **Files exist** - if files are referenced, verify they exist
- **Missing steps** - anything that should have been done but wasn't

## Constraints

- Do NOT modify any source files directly (only propose changes to the task doc)
- Keep the intent of the task the same
- Be thorough but efficient
${userInstructions}

## Current Task Content

--- TASK_START ---
${params.taskContent}
--- TASK_END ---

## Output Format (CRITICAL)

After verifying, return the UPDATED task document with:
1. Verification notes added as sub-items under completed items
2. Uncheck (\`- [ ]\`) any items that aren't actually done
3. Add a "## Verification Results" section at the end

Return the updated markdown between these exact markers:

===TASK_REVIEW_OUTPUT_START===
[full markdown content with verification notes]
===TASK_REVIEW_OUTPUT_END===

Example of verification annotation:
\`\`\`
- [x] Add error handling to API endpoint
  - ✓ Verified: Error handling added in \`src/api/handler.ts:45\`
- [ ] Fix login bug  ← unchecked because not actually fixed
  - ✗ Not found: Expected fix in \`src/auth/login.ts\` but code unchanged
\`\`\`

Now begin verification. Read files, run tests, and verify each completed item.`
}

export const tasksRouter = router({
  list: procedure.query(({ ctx }) => {
    return listTasks(ctx.workingDir)
  }),

  get: procedure
    .input(z.object({ path: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return getTask(ctx.workingDir, input.path)
    }),

  save: procedure
    .input(z.object({
      path: z.string().min(1),
      content: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      return saveTask(ctx.workingDir, input.path, input.content)
    }),

  create: procedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return createTask(ctx.workingDir, { title: input.title, content: input.content })
    }),

  /**
   * Create a task with agent-powered expansion.
   * Spawns an agent to convert the prompt into a detailed task plan.
   */
  createWithAgent: procedure
    .input(z.object({
      title: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create the task file first with placeholder content
      const { path: taskPath } = createTask(ctx.workingDir, {
        title: input.title,
        content: `# ${input.title}\n\n_Generating detailed task plan..._\n`,
      })

      // Build the expansion prompt
      const prompt = buildTaskExpansionPrompt({
        title: input.title,
        taskPath,
        workingDir: ctx.workingDir,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath,
        title: `Plan: ${input.title}`,
      })

      return {
        path: taskPath,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Delete a task file.
   */
  delete: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      return deleteTask(ctx.workingDir, input.path)
    }),

  /**
   * Assign an existing task to an agent for execution.
   * Spawns an agent that will work through the task plan.
   */
  assignToAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskExecutionPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Run: ${task.title}`,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Review the quality of a task spec (clarity, completeness, actionability).
   * Spawns an independent agent session for spec review.
   */
  reviewWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskSpecReviewPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Review: ${task.title}`,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Verify completed items against the codebase.
   * Spawns an agent that reads files, runs tests, and checks if items are actually done.
   */
  verifyWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskVerifyPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Verify: ${task.title}`,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Get active agent sessions for tasks.
   * Returns a map of taskPath -> session for all tasks with active agents.
   */
  getActiveAgentSessions: procedure.query(() => {
    const monitor = getProcessMonitor()
    const allDaemons = monitor.getAllDaemons()

    // Filter to daemons that have a taskPath and are still running
    const taskSessions: Record<string, { sessionId: string; status: string }> = {}

    for (const daemon of allDaemons) {
      if (daemon.config.taskPath && monitor.isProcessRunning(daemon.pid)) {
        taskSessions[daemon.config.taskPath] = {
          sessionId: daemon.sessionId,
          status: "running",
        }
      }
    }

    return taskSessions
  }),
})
