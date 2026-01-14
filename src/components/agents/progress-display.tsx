/**
 * Progress display showing todo list with visual indicators
 * Extracted from todo list data in agent output
 */

import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { AgentOutputChunk } from '@/lib/agent/types'

/** Todo item from TodoWrite tool calls */
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

/** Extract the latest todo list from output chunks */
export function extractTodos(output: AgentOutputChunk[]): TodoItem[] | null {
  // Find the last TodoWrite tool call
  for (let i = output.length - 1; i >= 0; i--) {
    const chunk = output[i]
    if (chunk.type !== 'tool_use') continue

    try {
      const parsed = JSON.parse(chunk.content)
      if (parsed.name === 'TodoWrite' && parsed.input?.todos) {
        return parsed.input.todos as TodoItem[]
      }
    } catch {
      // Not valid JSON or not a TodoWrite call
    }
  }
  return null
}

/** Progress display showing todo list with visual indicators */
export function ProgressDisplay({ todos }: { todos: TodoItem[] }) {
  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[10px] font-vcr text-muted-foreground">
          {completed}/{total}
        </span>
      </div>

      {/* Todo list */}
      <div className="space-y-1">
        {todos.map((todo, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            {todo.status === 'completed' ? (
              <CheckCircle2 className="w-3 h-3 text-chart-2 mt-0.5 flex-shrink-0" />
            ) : todo.status === 'in_progress' ? (
              <Loader2 className="w-3 h-3 text-primary animate-spin mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <span className={
              todo.status === 'completed' ? 'text-muted-foreground line-through' :
              todo.status === 'in_progress' ? 'text-primary' :
              'text-foreground/70'
            }>
              {todo.status === 'in_progress' ? (todo.activeForm ?? todo.content) : todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
