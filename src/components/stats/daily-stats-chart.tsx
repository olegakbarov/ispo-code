/**
 * DailyStatsChart Component
 *
 * Displays daily breakdown of sessions, tasks, tool calls, files, and tokens.
 * Shows trends over time in a table format.
 */

import { Calendar, Activity, CheckSquare, Zap, FileCode, Coins, CheckCircle, XCircle } from 'lucide-react'

interface DailyStats {
  date: string // YYYY-MM-DD format
  sessionsCreated: number
  sessionsCompleted: number
  sessionsFailed: number
  tasksCreated: number
  tasksCompleted: number
  toolCalls: number
  filesChanged: number
  tokensUsed: {
    input: number
    output: number
  }
}

interface DailyStatsChartProps {
  data: DailyStats[]
}

export function DailyStatsChart({ data }: DailyStatsChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Daily Activity</h2>
        </div>
        <div className="text-sm text-muted-foreground text-center py-8">
          No daily activity data available yet
        </div>
      </div>
    )
  }

  // Format date for display (e.g., "Jan 15" or "Jan 15, 2026" if different year)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    const now = new Date()
    const showYear = date.getFullYear() !== now.getFullYear()

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(showYear && { year: 'numeric' })
    })
  }

  // Calculate totals for comparison
  const totals = data.reduce((acc, day) => ({
    sessionsCreated: acc.sessionsCreated + day.sessionsCreated,
    sessionsCompleted: acc.sessionsCompleted + day.sessionsCompleted,
    sessionsFailed: acc.sessionsFailed + day.sessionsFailed,
    tasksCreated: acc.tasksCreated + day.tasksCreated,
    tasksCompleted: acc.tasksCompleted + day.tasksCompleted,
    toolCalls: acc.toolCalls + day.toolCalls,
    filesChanged: acc.filesChanged + day.filesChanged,
    tokensInput: acc.tokensInput + day.tokensUsed.input,
    tokensOutput: acc.tokensOutput + day.tokensUsed.output,
  }), {
    sessionsCreated: 0,
    sessionsCompleted: 0,
    sessionsFailed: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    toolCalls: 0,
    filesChanged: 0,
    tokensInput: 0,
    tokensOutput: 0,
  })

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Daily Activity</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.length} {data.length === 1 ? 'day' : 'days'} of data
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Date
                </div>
              </th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-center gap-1">
                  <CheckSquare className="h-3.5 w-3.5" />
                  Tasks
                </div>
                <div className="text-[10px] font-normal">done / new</div>
              </th>
              <th className="text-center py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  Sessions
                </div>
                <div className="text-[10px] font-normal flex items-center justify-center gap-1">
                  <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                  /
                  <XCircle className="h-2.5 w-2.5 text-red-500" />
                </div>
              </th>
              <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  Tools
                </div>
              </th>
              <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <FileCode className="h-3.5 w-3.5" />
                  Files
                </div>
              </th>
              <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  <Coins className="h-3.5 w-3.5" />
                  Tokens
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr
                key={day.date}
                className="border-b border-border/50 hover:bg-muted/50 transition-colors"
              >
                <td className="py-3 px-2 font-medium">
                  {formatDate(day.date)}
                </td>
                <td className="py-3 px-2 text-center tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {day.tasksCompleted > 0 ? day.tasksCompleted : '-'}
                  </span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {day.tasksCreated > 0 ? day.tasksCreated : '-'}
                  </span>
                </td>
                <td className="py-3 px-2 text-center tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {day.sessionsCompleted > 0 ? day.sessionsCompleted : '-'}
                  </span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-red-600 dark:text-red-400">
                    {day.sessionsFailed > 0 ? day.sessionsFailed : '-'}
                  </span>
                </td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {day.toolCalls > 0 ? day.toolCalls.toLocaleString() : '-'}
                </td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {day.filesChanged > 0 ? day.filesChanged : '-'}
                </td>
                <td className="py-3 px-2 text-right text-xs tabular-nums">
                  {day.tokensUsed.input + day.tokensUsed.output > 0 ? (
                    <span className="text-muted-foreground">
                      {formatTokens(day.tokensUsed.input + day.tokensUsed.output)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-3 px-2">Total</td>
              <td className="py-3 px-2 text-center tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {totals.tasksCompleted.toLocaleString()}
                </span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {totals.tasksCreated.toLocaleString()}
                </span>
              </td>
              <td className="py-3 px-2 text-center tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {totals.sessionsCompleted.toLocaleString()}
                </span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-red-600 dark:text-red-400">
                  {totals.sessionsFailed.toLocaleString()}
                </span>
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {totals.toolCalls.toLocaleString()}
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {totals.filesChanged.toLocaleString()}
              </td>
              <td className="py-3 px-2 text-right text-xs tabular-nums">
                {formatTokens(totals.tokensInput + totals.tokensOutput)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
