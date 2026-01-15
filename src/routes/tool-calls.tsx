/**
 * Tool Calls Gallery Page
 *
 * Sandbox for all tool-call UI states - enables faster design iteration
 * and regression spotting without running real agent sessions.
 */

import { createFileRoute } from '@tanstack/react-router'
import { ToolCall } from '@/components/agents/tool-call'
import { ToolResult } from '@/components/agents/tool-result'
import { AskUserQuestionDisplay } from '@/components/agents/ask-user-question-display'

export const Route = createFileRoute('/tool-calls')({
  component: ToolCallsPage,
})

function ToolCallsPage() {
  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Tool Calls Gallery</h1>
          <p className="text-muted-foreground">
            Visual reference for all tool-call components and states
          </p>
        </div>

        {/* Read Tool - Simple */}
        <Section title="Read Tool - Simple">
          <ToolCall
            toolName="Read"
            toolInput={{ file_path: "/src/components/ui/button.tsx" }}
          />
          <ToolResult
            content={'    1→import { cn } from "@/lib/utils"\n    2→\n    3→export function Button({ children, className, ...props }) {\n    4→  return (\n    5→    <button className={cn("px-4 py-2 rounded", className)} {...props}>\n    6→      {children}\n    7→    </button>\n    8→  )\n    9→}'}
            success={true}
            toolName="Read"
            filePath="/src/components/ui/button.tsx"
          />
        </Section>

        {/* Write Tool - With Content */}
        <Section title="Write Tool - With Content">
          <ToolCall
            toolName="Write"
            toolInput={{
              file_path: "/src/lib/utils/format.ts",
              content: "export function formatDate(date: Date): string {\n  return date.toISOString().split('T')[0]\n}"
            }}
          />
          <ToolResult
            content="File written successfully: /src/lib/utils/format.ts (89 bytes)"
            success={true}
            toolName="Write"
          />
        </Section>

        {/* Edit Tool - Collapsed by Default */}
        <Section title="Edit Tool - Large Content (Collapsed)">
          <ToolCall
            toolName="Edit"
            toolInput={{
              file_path: "/src/components/dashboard.tsx",
              old_string: "const [loading, setLoading] = useState(false)\nconst handleSubmit = async () => {\n  setLoading(true)\n  try {\n    await submitData()\n  } catch (err) {\n    console.error(err)\n  } finally {\n    setLoading(false)\n  }\n}",
              new_string: "const { mutate, isPending } = useMutation({\n  mutationFn: submitData,\n  onSuccess: () => toast.success('Saved!'),\n  onError: (err) => toast.error(err.message)\n})"
            }}
          />
          <ToolResult
            content="Edit applied successfully: /src/components/dashboard.tsx"
            success={true}
            toolName="Edit"
          />
        </Section>

        {/* Bash Tool - Success */}
        <Section title="Bash Tool - Success">
          <ToolCall
            toolName="Bash"
            toolInput={{ command: "npm test -- --watch=false" }}
          />
          <ToolResult
            content={`$ npm test -- --watch=false

> test
> vitest run

 ✓ src/lib/utils.test.ts (3)
   ✓ formatDate
   ✓ parseJSON
   ✓ debounce

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  14:32:01
   Duration  1.24s`}
            success={true}
            toolName="Bash"
          />
        </Section>

        {/* Bash Tool - Error */}
        <Section title="Bash Tool - Error">
          <ToolCall
            toolName="Bash"
            toolInput={{ command: "npm run build:production" }}
          />
          <ToolResult
            content={`error: Script "build:production" not found.

Available scripts:
  - dev
  - build
  - preview
  - test`}
            success={false}
            toolName="Bash"
          />
        </Section>

        {/* Glob Tool */}
        <Section title="Glob Tool - Pattern Matching">
          <ToolCall
            toolName="Glob"
            toolInput={{ pattern: "**/*.test.ts" }}
          />
          <ToolResult
            content={`src/lib/utils.test.ts
src/lib/agent/manager.test.ts
src/components/ui/button.test.ts
src/hooks/use-debounce.test.ts`}
            success={true}
            toolName="Glob"
          />
        </Section>

        {/* Grep Tool */}
        <Section title="Grep Tool - Search Results">
          <ToolCall
            toolName="Grep"
            toolInput={{
              pattern: "useState",
              glob: "**/*.tsx",
              output_mode: "content"
            }}
          />
          <ToolResult
            content={`src/components/dashboard.tsx:12:  const [count, setCount] = useState(0)
src/components/settings.tsx:8:  const [theme, setTheme] = useState('dark')
src/components/modal.tsx:15:  const [open, setOpen] = useState(false)`}
            success={true}
            toolName="Grep"
          />
        </Section>

        {/* Task Tool */}
        <Section title="Task Tool - Agent Spawn">
          <ToolCall
            toolName="Task"
            toolInput={{
              description: "Refactor auth system",
              prompt: "Refactor the authentication system to use JWT tokens instead of sessions",
              subagent_type: "general-purpose"
            }}
          />
          <ToolResult
            content="Agent spawned successfully (session: abc123)\nTask started: Refactor auth system"
            success={true}
            toolName="Task"
          />
        </Section>

        {/* AskUserQuestion - Single Question */}
        <Section title="AskUserQuestion - Single Choice">
          <AskUserQuestionDisplay
            toolInput={{
              questions: [
                {
                  question: "Which authentication method should we implement?",
                  header: "Auth method",
                  multiSelect: false,
                  options: [
                    {
                      label: "JWT with refresh tokens (Recommended)",
                      description: "Industry standard, stateless, scalable. Best for SPAs and mobile apps."
                    },
                    {
                      label: "Session-based auth",
                      description: "Traditional approach, server-side sessions. Simpler but less scalable."
                    },
                    {
                      label: "OAuth2 / Social login",
                      description: "Delegate to third-party providers (Google, GitHub). Best UX but adds dependencies."
                    }
                  ]
                }
              ]
            }}
          />
        </Section>

        {/* AskUserQuestion - Multiple Questions */}
        <Section title="AskUserQuestion - Multiple Questions">
          <AskUserQuestionDisplay
            toolInput={{
              questions: [
                {
                  question: "Which state management library should we use?",
                  header: "State",
                  multiSelect: false,
                  options: [
                    {
                      label: "Zustand (Recommended)",
                      description: "Lightweight, simple API, minimal boilerplate"
                    },
                    {
                      label: "Redux Toolkit",
                      description: "Industry standard with extensive ecosystem"
                    }
                  ]
                },
                {
                  question: "Which testing utilities do you want to include?",
                  header: "Testing",
                  multiSelect: true,
                  options: [
                    {
                      label: "MSW (Mock Service Worker)",
                      description: "API mocking for tests and development"
                    },
                    {
                      label: "Testing Library",
                      description: "Component testing with user-centric queries"
                    },
                    {
                      label: "Playwright",
                      description: "End-to-end testing framework"
                    }
                  ]
                }
              ]
            }}
          />
        </Section>

        {/* WebFetch Tool */}
        <Section title="WebFetch Tool">
          <ToolCall
            toolName="WebFetch"
            toolInput={{
              url: "https://api.github.com/repos/facebook/react",
              prompt: "Get the repository description and star count"
            }}
          />
          <ToolResult
            content={`Repository: facebook/react
Description: A declarative, efficient, and flexible JavaScript library for building user interfaces.
Stars: 234,567
Language: JavaScript
License: MIT`}
            success={true}
            toolName="WebFetch"
          />
        </Section>

        {/* WebSearch Tool */}
        <Section title="WebSearch Tool">
          <ToolCall
            toolName="WebSearch"
            toolInput={{
              query: "react server components best practices 2026"
            }}
          />
          <ToolResult
            content={`Found 8 results:

1. React Server Components: Patterns and Best Practices
   https://react.dev/blog/2026/01/rsc-patterns

2. Server Components Architecture Guide
   https://nextjs.org/docs/app/server-components

3. Common Pitfalls with React Server Components
   https://vercel.com/blog/rsc-pitfalls`}
            success={true}
            toolName="WebSearch"
          />
        </Section>

        {/* TodoWrite Tool */}
        <Section title="TodoWrite Tool">
          <ToolCall
            toolName="TodoWrite"
            toolInput={{
              todos: [
                {
                  content: "Set up API endpoints",
                  activeForm: "Setting up API endpoints",
                  status: "completed"
                },
                {
                  content: "Implement authentication",
                  activeForm: "Implementing authentication",
                  status: "in_progress"
                },
                {
                  content: "Add error handling",
                  activeForm: "Adding error handling",
                  status: "pending"
                }
              ]
            }}
          />
          <ToolResult
            content="Todo list updated: 3 items (1 completed, 1 in progress, 1 pending)"
            success={true}
            toolName="TodoWrite"
          />
        </Section>

        {/* Long Content - Truncated */}
        <Section title="Read Tool - Long Content (Truncated)">
          <ToolCall
            toolName="Read"
            toolInput={{ file_path: "/src/lib/agent/manager.ts", limit: 100 }}
          />
          <ToolResult
            content={`    1→/**
    2→ * AgentManager - Orchestrates agent lifecycle and session management
    3→ *
    4→ * This is the core orchestrator for spawning, tracking, and managing
    5→ * agent sessions. It handles:
    6→ * - Session creation and cleanup
    7→ * - Git worktree isolation
    8→ * - Inter-process communication
    9→ * - Event streaming to clients
   10→ */
   11→
   12→import { EventEmitter } from 'node:events'
   13→import { v4 as uuidv4 } from 'uuid'
   14→import { createWorktree, deleteWorktree } from './git-worktree'
   15→import { ClaudeAgent } from './implementations/claude'
   16→import { CerebrasAgent } from './implementations/cerebras'
   17→import { OpenCodeAgent } from './implementations/opencode'
   18→import { CodexAgent } from './implementations/codex'
   19→
   20→export class AgentManager extends EventEmitter {
   21→  private sessions = new Map<string, AgentSession>()
   22→  private activeProcesses = new Map<string, ChildProcess>()
   23→
   24→  constructor(private workingDir: string) {
   25→    super()
   26→    this.cleanupOrphanedWorktrees()
   27→  }
   28→
   29→  async spawnAgent(config: AgentConfig): Promise<string> {
   30→    const sessionId = uuidv4()
   31→
   32→    // Create isolated worktree if enabled
   33→    let worktreePath: string | undefined
   34→    let worktreeBranch: string | undefined
   35→
   36→    if (!process.env.DISABLE_WORKTREE_ISOLATION) {
   37→      const worktree = await createWorktree(this.workingDir, sessionId)
   38→      worktreePath = worktree.path
   39→      worktreeBranch = worktree.branch
   40→    }
${'    '.repeat(10)}
... (500+ more lines)

★ File truncated at 500 characters. Click expand to see full content.`}
            success={true}
            toolName="Read"
            filePath="/src/lib/agent/manager.ts"
          />
        </Section>

        {/* Error States */}
        <Section title="Error States">
          <ToolCall
            toolName="Read"
            toolInput={{ file_path: "/nonexistent/file.ts" }}
          />
          <ToolResult
            content="error: ENOENT: no such file or directory, open '/nonexistent/file.ts'"
            success={false}
            toolName="Read"
          />
        </Section>

        <Section title="Tool with No Input">
          <ToolCall
            toolName="GetStatus"
            toolInput={null}
          />
          <ToolResult
            content='{"status": "running", "uptime": 3600, "activeSessions": 2}'
            success={true}
            toolName="GetStatus"
          />
        </Section>
      </div>
    </div>
  )
}

/**
 * Section wrapper for organized display
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-2">
        {title}
      </h2>
      <div className="space-y-2 pl-2">
        {children}
      </div>
    </section>
  )
}
