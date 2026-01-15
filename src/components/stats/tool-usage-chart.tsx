/**
 * ToolUsageChart Component
 *
 * Displays tool usage breakdown as a bar chart.
 * Shows both by-tool and by-type statistics.
 */

interface ToolStats {
  byTool: Array<{ tool: string; count: number }>
  byType: Array<{ type: string; count: number }>
  totalCalls: number
}

interface ToolUsageChartProps {
  data: ToolStats
}

export function ToolUsageChart({ data }: ToolUsageChartProps) {
  const maxCount = Math.max(...data.byTool.map((t) => t.count), 1)
  const topTools = data.byTool.slice(0, 10) // Show top 10 tools

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Tool Usage</h2>
        <p className="text-sm text-muted-foreground">
          {data.totalCalls.toLocaleString()} total tool calls
        </p>
      </div>

      {/* By Type */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">By Type</h3>
        <div className="space-y-1">
          {data.byType.map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <div className="w-16 text-xs text-muted-foreground capitalize">
                {item.type}
              </div>
              <div className="flex-1 h-6 bg-secondary rounded-sm relative overflow-hidden">
                <div
                  className="h-full bg-primary/20 transition-all"
                  style={{ width: `${(item.count / data.totalCalls) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end px-2">
                  <span className="text-xs font-medium">{item.count.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Tool (Top 10) */}
      {topTools.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Top Tools</h3>
          <div className="space-y-1">
            {topTools.map((item) => (
              <div key={item.tool} className="flex items-center gap-2">
                <div className="w-20 text-xs text-muted-foreground truncate" title={item.tool}>
                  {item.tool}
                </div>
                <div className="flex-1 h-6 bg-secondary rounded-sm relative overflow-hidden">
                  <div
                    className="h-full bg-blue-500/20 transition-all"
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end px-2">
                    <span className="text-xs font-medium">{item.count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
