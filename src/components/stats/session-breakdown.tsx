/**
 * SessionBreakdown Component
 *
 * Displays session statistics grouped by type, status, and agent type.
 */

interface SessionBreakdown {
  byType: Array<{ sessionType: string; count: number }>
  byStatus: Array<{ status: string; count: number }>
  byAgentType: Array<{ agentType: string; count: number }>
}

interface SessionBreakdownProps {
  data: SessionBreakdown
}

export function SessionBreakdown({ data }: SessionBreakdownProps) {
  const totalSessions = data.byStatus.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Session Breakdown</h2>
        <p className="text-sm text-muted-foreground">
          {totalSessions.toLocaleString()} total sessions
        </p>
      </div>

      {/* By Type */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">By Type</h3>
        <div className="space-y-1">
          {data.byType.map((item) => (
            <div key={item.sessionType} className="flex items-center justify-between text-sm">
              <span className="capitalize">{item.sessionType}</span>
              <span className="font-medium">{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Status */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">By Status</h3>
        <div className="space-y-1">
          {data.byStatus.map((item) => (
            <div key={item.status} className="flex items-center justify-between text-sm">
              <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
              <span className="font-medium">{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Agent Type */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">By Agent</h3>
        <div className="space-y-1">
          {data.byAgentType.map((item) => (
            <div key={item.agentType} className="flex items-center justify-between text-sm">
              <span className="capitalize">{item.agentType}</span>
              <span className="font-medium">{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
