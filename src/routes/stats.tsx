/**
 * Stats Page Route
 *
 * Displays aggregate statistics across all tasks and agent sessions.
 * Shows KPIs, tool usage, file changes, and session breakdowns.
 */

import { createFileRoute } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { StatCard } from '@/components/stats/stat-card'
import { ToolUsageChart } from '@/components/stats/tool-usage-chart'
import { FileChangesTable } from '@/components/stats/file-changes-table'
import { SessionBreakdown } from '@/components/stats/session-breakdown'
import { TaskStatsTable } from '@/components/stats/task-stats-table'
import { HotFilesTable } from '@/components/stats/hot-files-table'
import { DailyStatsChart } from '@/components/stats/daily-stats-chart'
import { SessionMetrics } from '@/components/stats/session-metrics'
import { Activity, FileCode, Zap, Database, CheckCircle, Clock, Gauge, MessageSquare } from 'lucide-react'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

/**
 * Format milliseconds into human-readable duration
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

function StatsPage() {
  // Load all stats data
  const overviewQuery = trpc.stats.getOverview.useQuery()
  const toolStatsQuery = trpc.stats.getToolStats.useQuery()
  const toolDetailsQuery = trpc.stats.getToolCallDetails.useQuery()
  const hotFilesQuery = trpc.stats.getHotFiles.useQuery()
  const fileChangesQuery = trpc.stats.getFileChanges.useQuery()
  const sessionStatsQuery = trpc.stats.getSessionStats.useQuery()
  const taskMetricsQuery = trpc.stats.getTaskMetrics.useQuery()
  const dailyStatsQuery = trpc.stats.getDailyStats.useQuery()

  const isLoading = overviewQuery.isLoading || toolStatsQuery.isLoading || toolDetailsQuery.isLoading || hotFilesQuery.isLoading || fileChangesQuery.isLoading || sessionStatsQuery.isLoading || taskMetricsQuery.isLoading || dailyStatsQuery.isLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading statistics...</div>
      </div>
    )
  }

  const overview = overviewQuery.data
  const toolStats = toolStatsQuery.data
  const toolDetails = toolDetailsQuery.data
  const hotFiles = hotFilesQuery.data
  const fileChanges = fileChangesQuery.data
  const sessionStats = sessionStatsQuery.data
  const taskMetrics = taskMetricsQuery.data
  const dailyStats = dailyStatsQuery.data

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground">
            Aggregate metrics across all tasks and agent sessions
          </p>
        </div>

        {/* KPI Cards - Row 1: Totals */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Database className="h-4 w-4" />}
              label="Total Tasks"
              value={overview.totalTasks}
              iconColor="text-blue-500"
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Total Sessions"
              value={overview.totalSessions}
              subtitle={`${overview.activeSessions} active, ${overview.completedSessions} completed`}
              iconColor="text-green-500"
            />
            <StatCard
              icon={<FileCode className="h-4 w-4" />}
              label="Files Changed"
              value={overview.totalFilesChanged}
              iconColor="text-purple-500"
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Tool Calls"
              value={overview.totalToolCalls}
              iconColor="text-orange-500"
            />
          </div>
        )}

        {/* KPI Cards - Row 2: Efficiency Metrics */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<CheckCircle className="h-4 w-4" />}
              label="Success Rate"
              value={`${overview.successRate.toFixed(1)}%`}
              subtitle={`${overview.completedSessions} succeeded, ${overview.failedSessions} failed`}
              iconColor="text-emerald-500"
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Avg Duration"
              value={formatDuration(overview.avgDurationMs)}
              subtitle="per completed session"
              iconColor="text-sky-500"
            />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              label="Avg Context Use"
              value={`${overview.avgContextUtilization.toFixed(1)}%`}
              subtitle="of context window"
              iconColor="text-amber-500"
            />
            <StatCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Total Messages"
              value={overview.totalMessages}
              subtitle={`~${overview.avgMessagesPerSession.toFixed(1)} per session`}
              iconColor="text-violet-500"
            />
          </div>
        )}

        {/* Session & Output Metrics */}
        {overview && (
          <SessionMetrics data={overview} />
        )}

        {/* Daily Activity Stats */}
        {dailyStats && (
          <div>
            <DailyStatsChart data={dailyStats} />
          </div>
        )}

        {/* Tool Usage & Session Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {toolStats && <ToolUsageChart data={toolStats} details={toolDetails} />}
          {sessionStats && <SessionBreakdown data={sessionStats} />}
        </div>

        {/* Hot Files Table */}
        {hotFiles && (
          <div>
            <HotFilesTable data={hotFiles} />
          </div>
        )}

        {/* File Changes Table */}
        {fileChanges && (
          <div>
            <FileChangesTable data={fileChanges} />
          </div>
        )}

        {/* Task Metrics Table */}
        {taskMetrics && (
          <div>
            <TaskStatsTable data={taskMetrics} />
          </div>
        )}
      </div>
    </div>
  )
}
