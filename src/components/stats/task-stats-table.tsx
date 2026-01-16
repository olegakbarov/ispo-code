/**
 * TaskStatsTable Component
 *
 * Displays per-task metrics in a sortable table for drill-down analysis.
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { match } from 'ts-pattern'
import { ArrowUpDown, FileCode, Zap, Activity } from 'lucide-react'

interface TaskMetrics {
  path: string
  title: string
  sessionCount: number
  filesChanged: number
  toolCalls: number
  tokensUsed: {
    input: number
    output: number
  }
  lastActivity: string
}

interface TaskStatsTableProps {
  data: TaskMetrics[]
}

type SortField = 'title' | 'sessionCount' | 'filesChanged' | 'toolCalls' | 'tokensUsed' | 'lastActivity'
type SortDirection = 'asc' | 'desc'

export function TaskStatsTable({ data }: TaskStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('lastActivity')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [limit, setLimit] = useState(20)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const comparison = match(sortField)
      .with('title', () => a.title.localeCompare(b.title))
      .with('sessionCount', () => a.sessionCount - b.sessionCount)
      .with('filesChanged', () => a.filesChanged - b.filesChanged)
      .with('toolCalls', () => a.toolCalls - b.toolCalls)
      .with('tokensUsed', () => (a.tokensUsed.input + a.tokensUsed.output) - (b.tokensUsed.input + b.tokensUsed.output))
      .with('lastActivity', () => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime())
      .exhaustive()

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const displayedData = sortedData.slice(0, limit)
  const hasMore = sortedData.length > limit

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTokens = (tokens: { input: number; output: number }) => {
    const total = tokens.input + tokens.output
    if (total === 0) return '-'
    if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`
    if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
    return total.toLocaleString()
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-muted-foreground">No task metrics available</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Task Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Per-task breakdown of sessions, file changes, and tool usage
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Task
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('sessionCount')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Activity className="h-3 w-3" />
                  Sessions
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('filesChanged')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <FileCode className="h-3 w-3" />
                  Files
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('toolCalls')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Zap className="h-3 w-3" />
                  Tools
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-center px-4 py-2">
                <button
                  onClick={() => handleSort('tokensUsed')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Tokens
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-right px-4 py-2">
                <button
                  onClick={() => handleSort('lastActivity')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground ml-auto"
                >
                  Last Activity
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedData.map((task) => (
              <tr key={task.path} className="border-b border-border hover:bg-secondary/30">
                <td className="px-4 py-2">
                  <Link
                    to="/tasks/$"
                    params={{ _splat: task.path }}
                    search={{ archiveFilter: 'all' }}
                    className="text-sm hover:underline"
                  >
                    {task.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="text-sm font-medium">
                    {task.sessionCount > 0 ? task.sessionCount : '-'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="text-sm">
                    {task.filesChanged > 0 ? task.filesChanged : '-'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="text-sm">
                    {task.toolCalls > 0 ? task.toolCalls.toLocaleString() : '-'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="text-sm text-muted-foreground">
                    {formatTokens(task.tokensUsed)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(task.lastActivity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="p-4 border-t border-border text-center">
          <button
            onClick={() => setLimit(limit + 20)}
            className="text-sm text-primary hover:underline"
          >
            Show more ({sortedData.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
