/**
 * Tasks tRPC Router
 *
 * Tasks are markdown files stored in the repo (see task-service).
 */

import { z } from "zod"
import { randomBytes } from "crypto"
import { router, procedure } from "./trpc"
import { createTask, deleteTask, getTask, listTasks, saveTask, archiveTask, restoreTask } from "@/lib/agent/task-service"
import { getProcessMonitor } from "@/daemon/process-monitor"
import { getStreamServerUrl } from "@/streams/server"
import { getStreamAPI } from "@/streams/client"
import { getGitStatus } from "@/lib/agent/git-service"
import type { SessionStatus } from "@/lib/agent/types"
import type { RegistryEvent } from "@/streams/schemas"

/**
 * System prompt for debugging task with systematic-debugging skill.
 * Invokes the systematic-debugging skill to investigate and fix bugs.
 */
function buildTaskDebugPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
}): string {
  return `You are investigating and fixing a bug. Use the systematic-debugging skill to methodically diagnose and resolve the issue.

## Bug Report
"${params.title}"

## Instructions
1. Use the Skill tool to invoke systematic-debugging: skill: "systematic-debugging", args: "${params.title}"
2. Follow the systematic debugging methodology (four phases)
3. **CRITICAL: Write findings to ${params.taskPath} after EACH phase**

## Documentation Requirements

After each phase, update ${params.taskPath} with your findings using this structure:

\`\`\`markdown
# ${params.title}

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: [Where error manifests]
- **Immediate Cause**: [Code directly producing error]
- **Call Chain**: [Trace backward through stack]
- **Original Trigger**: [Where problem started]
- **Evidence**: [Logs, stack traces, state dumps]

### Phase 2: Pattern Analysis
- **Working Examples**: [Similar code that works]
- **Key Differences**: [What differs between working and broken]
- **Dependencies**: [What this code depends on]

### Phase 3: Hypothesis & Testing
- **Hypothesis**: [Clear statement: "Error occurs because X"]
- **Test Design**: [Minimal test changing ONE variable]
- **Prediction**: [Expected outcome if hypothesis correct]
- **Result**: [What actually happened]
- **Conclusion**: [Hypothesis confirmed/refuted]

### Phase 4: Implementation
- **Root Cause**: [Final determination]
- **Solution**: [Fix addressing root cause]
- **Test Case**: [Failing test capturing bug]
- **Verification**: [Test passes, full suite passes]
- **Changes Made**: [Files modified with brief description]

## Success Criteria
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not symptoms)
- [ ] Test created reproducing bug
- [ ] All tests pass
\`\`\`

## Checkpoint Reminders

- **After Phase 1**: Write Root Cause Investigation findings to ${params.taskPath}
- **After Phase 2**: Write Pattern Analysis findings to ${params.taskPath}
- **After Phase 3**: Write Hypothesis & Testing results to ${params.taskPath}
- **After Phase 4**: Write Implementation details to ${params.taskPath}

## Working Directory
${params.workingDir}

Begin by invoking the systematic-debugging skill now. Remember to update ${params.taskPath} after each phase completes.`
}

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

/**
 * System prompt for task rewrite agent.
 * The agent rewrites the task plan based on user feedback/comments.
 */
function buildTaskRewritePrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  userComment: string
}): string {
  return `You are a task planning expert. Your job is to rewrite an existing task plan based on user feedback.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## Current Task Plan

--- CURRENT_TASK ---
${params.taskContent}
--- END_CURRENT_TASK ---

## User Feedback

The user has requested changes to this task plan:

"""
${params.userComment}
"""

## Your Mission

1. **Understand the feedback**: Analyze what the user wants changed
2. **Explore the codebase**: Use tools (read, glob, grep) to gather context if needed
3. **Rewrite the plan**: Generate a new task plan that incorporates the user's feedback
4. **Maintain quality**: Keep the plan concise, actionable, and well-structured

## Output Requirements

Write the rewritten task plan directly to: ${params.taskPath}

Use the same format as task expansion:

\`\`\`markdown
# [Task Title]

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
- **Incorporate user feedback** - address all points they mentioned
- **Keep what works** - if parts of the original plan are good and user didn't mention them, keep them

Begin now. Explore codebase if needed, then write the rewritten plan to ${params.taskPath}.`
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
      taskType: z.enum(["bug", "feature"]).default("feature"),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras", "gemini"]).default("claude"),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create the task file first with placeholder content
      const { path: taskPath } = createTask(ctx.workingDir, {
        title: input.title,
        content: `# ${input.title}\n\n_${input.taskType === 'bug' ? 'Investigating bug...' : 'Generating detailed task plan...'}_\n`,
      })

      // Build the appropriate prompt based on task type
      const prompt = input.taskType === 'bug'
        ? buildTaskDebugPrompt({
            title: input.title,
            taskPath,
            workingDir: ctx.workingDir,
          })
        : buildTaskExpansionPrompt({
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
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath,
        title: `${input.taskType === 'bug' ? 'Debug' : 'Plan'}: ${input.title}`,
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
   * Archive a task by moving it to tasks/archive/YYYY-MM/
   * Validates that all task changes are committed before archiving.
   */
  archive: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for uncommitted changes before archiving
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      const taskSessionIds = registryEvents
        .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
          event.type === "session_created" && event.taskPath === input.path
        )
        .map((event) => event.sessionId)

      if (taskSessionIds.length > 0) {
        const changedFilePaths = new Set<string>()
        const { agentRouter } = await import("./agent")
        const caller = agentRouter.createCaller({ workingDir: "" })

        for (const sessionId of taskSessionIds) {
          try {
            const changedFiles = await caller.getChangedFiles({ sessionId })
            for (const file of changedFiles) {
              const pathToCheck = file.repoRelativePath || file.relativePath || file.path
              changedFilePaths.add(pathToCheck)
            }
          } catch {
            continue
          }
        }

        if (changedFilePaths.size > 0) {
          const gitStatus = getGitStatus(ctx.workingDir)
          const uncommittedInGit = new Set<string>()
          for (const f of gitStatus.staged) uncommittedInGit.add(f.file)
          for (const f of gitStatus.modified) uncommittedInGit.add(f.file)
          for (const f of gitStatus.untracked) uncommittedInGit.add(f)

          const uncommittedFiles: string[] = []
          for (const taskFile of changedFilePaths) {
            if (uncommittedInGit.has(taskFile)) {
              uncommittedFiles.push(taskFile)
            }
          }

          if (uncommittedFiles.length > 0) {
            throw new Error(`Cannot archive: ${uncommittedFiles.length} file(s) have uncommitted changes. Commit changes before archiving.`)
          }
        }
      }

      return archiveTask(ctx.workingDir, input.path)
    }),

  /**
   * Restore an archived task back to tasks/
   */
  restore: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      return restoreTask(ctx.workingDir, input.path)
    }),

  /**
   * Assign an existing task to an agent for execution.
   * Spawns an agent that will work through the task plan.
   */
  assignToAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras", "gemini"]).default("claude"),
      model: z.string().optional(),
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
        model: input.model,
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
      agentType: z.enum(["claude", "codex", "opencode", "cerebras", "gemini"]).default("claude"),
      model: z.string().optional(),
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
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Review: ${task.title}`,
        instructions: input.instructions,
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
      agentType: z.enum(["claude", "codex", "opencode", "cerebras", "gemini"]).default("claude"),
      model: z.string().optional(),
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
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Verify: ${task.title}`,
        instructions: input.instructions,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Rewrite a task plan based on user feedback.
   * Spawns an agent that rewrites the plan according to the user's comment.
   */
  rewriteWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras", "gemini"]).default("claude"),
      model: z.string().optional(),
      userComment: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskRewritePrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        userComment: input.userComment,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Rewrite: ${task.title}`,
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
   *
   * Uses durable streams instead of process monitor for reliability:
   * - No race conditions during daemon spawn
   * - Survives server restarts
   * - Always consistent with actual session state
   */
  getActiveAgentSessions: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    // Track deleted sessions
    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Find all session_created events with taskPath (exclude deleted sessions)
    const taskSessions: Record<string, { sessionId: string; status: SessionStatus }> = {}

    for (const event of registryEvents) {
      if (
        event.type === "session_created" &&
        event.taskPath &&
        !deletedSessionIds.has(event.sessionId)
      ) {
        // Find the latest status for this session
        const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
        const latestStatusEvent = [...sessionEvents]
          .reverse()
          .find((e) =>
            e.type === "session_updated" ||
            e.type === "session_completed" ||
            e.type === "session_failed" ||
            e.type === "session_cancelled"
          )

        let status: SessionStatus = "pending"
        if (latestStatusEvent) {
          if (latestStatusEvent.type === "session_updated") {
            status = latestStatusEvent.status
          } else if (latestStatusEvent.type === "session_completed") {
            status = "completed"
          } else if (latestStatusEvent.type === "session_failed") {
            status = "failed"
          } else if (latestStatusEvent.type === "session_cancelled") {
            status = "cancelled"
          }
        }

        // Only include active sessions (not completed, failed, or cancelled)
        const activeStatuses: SessionStatus[] = ["pending", "running", "working", "waiting_approval", "waiting_input", "idle"]
        if (activeStatuses.includes(status)) {
          // Use the most recent active session for each task
          taskSessions[event.taskPath] = {
            sessionId: event.sessionId,
            status,
          }
        }
      }
    }

    return taskSessions
  }),

  /**
   * Get all sessions related to a task (planning, review, verify, execution).
   * Returns sessions grouped by type and sorted by timestamp.
   */
  getSessionsForTask: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all session_created events for this task
      const taskSessions = registryEvents
        .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
          event.type === "session_created" && event.taskPath === input.path
        )
        .map((event) => {
          // Find the latest status for this session
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          // Determine session type based on title prefix or sourceFile presence
          let sessionType: "planning" | "review" | "verify" | "execution" | "debug" | "rewrite" | "comment" = "execution"

          // Comment sessions take precedence (file-originated threads)
          if (event.sourceFile) {
            sessionType = "comment"
          } else if (event.title) {
            const titleLower = event.title.toLowerCase()
            if (titleLower.startsWith("plan:") || titleLower.startsWith("debug:")) {
              sessionType = "planning"
            } else if (titleLower.startsWith("review:")) {
              sessionType = "review"
            } else if (titleLower.startsWith("verify:")) {
              sessionType = "verify"
            } else if (titleLower.startsWith("rewrite:")) {
              sessionType = "rewrite"
            } else if (titleLower.startsWith("run:")) {
              sessionType = "execution"
            }
          }

          return {
            sessionId: event.sessionId,
            agentType: event.agentType,
            title: event.title || "Untitled Session",
            status,
            timestamp: event.timestamp,
            sessionType,
            model: event.model,
            sourceFile: event.sourceFile,
            sourceLine: event.sourceLine,
          }
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Group by session type
      const grouped = {
        planning: taskSessions.filter((s) => s.sessionType === "planning"),
        review: taskSessions.filter((s) => s.sessionType === "review"),
        verify: taskSessions.filter((s) => s.sessionType === "verify"),
        execution: taskSessions.filter((s) => s.sessionType === "execution"),
        rewrite: taskSessions.filter((s) => s.sessionType === "rewrite"),
        comment: taskSessions.filter((s) => s.sessionType === "comment"),
      }

      return {
        all: taskSessions,
        grouped,
      }
    }),

  /**
   * Get all files changed across all sessions for a task.
   * Aggregates changed files from all task sessions (planning, review, verify, execution).
   */
  getChangedFilesForTask: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all session_created events for this task
      const taskSessionIds = registryEvents
        .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
          event.type === "session_created" && event.taskPath === input.path
        )
        .map((event) => event.sessionId)

      // Aggregate changed files from all sessions
      const allFiles = new Map<string, {
        path: string
        relativePath?: string
        repoRelativePath?: string
        operation: "create" | "edit" | "delete"
        timestamp: string
        toolUsed: string
        sessionId: string
      }>()

      // Import agent router to get changed files
      const { agentRouter } = await import("./agent")
      const caller = agentRouter.createCaller({ workingDir: "" })

      for (const sessionId of taskSessionIds) {
        try {
          // Use agent.getChangedFiles to get files for this session
          const changedFiles = await caller.getChangedFiles({ sessionId })

          // Add files to map (using path as key to deduplicate)
          for (const file of changedFiles) {
            // Use the latest operation for each file path
            const existing = allFiles.get(file.path)
            if (!existing || new Date(file.timestamp) > new Date(existing.timestamp)) {
              allFiles.set(file.path, {
                path: file.path,
                relativePath: file.relativePath,
                repoRelativePath: file.repoRelativePath,
                operation: file.operation,
                timestamp: file.timestamp,
                toolUsed: file.toolUsed,
                sessionId,
              })
            }
          }
        } catch (error) {
          // Skip sessions that can't be read
          continue
        }
      }

      // Convert map to array and sort by timestamp (newest first)
      return Array.from(allFiles.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }),

  /**
   * Check if a task has uncommitted changes.
   * Aggregates changed files from all task sessions and checks git status.
   */
  hasUncommittedChanges: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all session_created events for this task
      const taskSessionIds = registryEvents
        .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
          event.type === "session_created" && event.taskPath === input.path
        )
        .map((event) => event.sessionId)

      if (taskSessionIds.length === 0) {
        return { hasUncommitted: false, uncommittedCount: 0, uncommittedFiles: [] }
      }

      // Get changed files from all sessions
      const changedFilePaths = new Set<string>()
      const { agentRouter } = await import("./agent")
      const caller = agentRouter.createCaller({ workingDir: "" })

      for (const sessionId of taskSessionIds) {
        try {
          const changedFiles = await caller.getChangedFiles({ sessionId })
          for (const file of changedFiles) {
            // Use repoRelativePath if available, otherwise relativePath
            const pathToCheck = file.repoRelativePath || file.relativePath || file.path
            changedFilePaths.add(pathToCheck)
          }
        } catch {
          // Skip sessions that can't be read
          continue
        }
      }

      if (changedFilePaths.size === 0) {
        return { hasUncommitted: false, uncommittedCount: 0, uncommittedFiles: [] }
      }

      // Get current git status
      const gitStatus = getGitStatus(ctx.workingDir)

      // Build set of all uncommitted files (staged, modified, untracked)
      const uncommittedInGit = new Set<string>()
      for (const f of gitStatus.staged) uncommittedInGit.add(f.file)
      for (const f of gitStatus.modified) uncommittedInGit.add(f.file)
      for (const f of gitStatus.untracked) uncommittedInGit.add(f)

      // Find task files that are uncommitted
      const uncommittedFiles: string[] = []
      for (const taskFile of changedFilePaths) {
        if (uncommittedInGit.has(taskFile)) {
          uncommittedFiles.push(taskFile)
        }
      }

      return {
        hasUncommitted: uncommittedFiles.length > 0,
        uncommittedCount: uncommittedFiles.length,
        uncommittedFiles,
      }
    }),
})
