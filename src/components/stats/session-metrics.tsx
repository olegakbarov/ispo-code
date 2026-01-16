/**
 * SessionMetrics Component
 *
 * Displays detailed session efficiency and output metrics in a grid.
 */

import { Coins, MessageCircle, FileOutput, Timer } from 'lucide-react'

interface SessionMetricsProps {
  data: {
    totalTokensUsed: { input: number; output: number }
    avgOutputTokens: number
    totalMessages: number
    avgMessagesPerSession: number
    avgDurationMs: number
    successRate: number
    completedSessions: number
    failedSessions: number
  }
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Format milliseconds into compact duration
 */
function formatDuration(ms: number): string {
  if (ms === 0) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  return `${seconds}s`
}

export function SessionMetrics({ data }: SessionMetricsProps) {
  const totalTokens = data.totalTokensUsed.input + data.totalTokensUsed.output

  const metrics = [
    {
      icon: <Coins className="h-4 w-4" />,
      label: 'Total Tokens',
      value: formatNumber(totalTokens),
      detail: `${formatNumber(data.totalTokensUsed.input)} in / ${formatNumber(data.totalTokensUsed.output)} out`,
      color: 'text-amber-500',
    },
    {
      icon: <FileOutput className="h-4 w-4" />,
      label: 'Avg Output Tokens',
      value: formatNumber(Math.round(data.avgOutputTokens)),
      detail: 'per completed session',
      color: 'text-cyan-500',
    },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      label: 'Total Messages',
      value: formatNumber(data.totalMessages),
      detail: `~${data.avgMessagesPerSession.toFixed(1)} per session`,
      color: 'text-violet-500',
    },
    {
      icon: <Timer className="h-4 w-4" />,
      label: 'Avg Duration',
      value: formatDuration(data.avgDurationMs),
      detail: 'per completed session',
      color: 'text-sky-500',
    },
  ]

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-4">Session & Output Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className={metric.color}>{metric.icon}</div>
              <span className="text-xs uppercase tracking-wide">{metric.label}</span>
            </div>
            <div className="text-xl font-bold">{metric.value}</div>
            <div className="text-xs text-muted-foreground">{metric.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
