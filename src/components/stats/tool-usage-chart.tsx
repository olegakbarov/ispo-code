/**
 * ToolUsageChart Component
 *
 * Displays tool usage breakdown as a bar chart.
 * Shows both by-tool and by-type statistics.
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ToolStats {
  byTool: Array<{ tool: string; count: number }>
  byType: Array<{ type: string; count: number }>
  totalCalls: number
}

interface ToolCallDetails {
  tool: string
  totalCalls: number
  sessions: Array<{
    sessionId: string
    taskPath?: string
    callCount: number
  }>
  firstUsed: string
  lastUsed: string
}

interface ToolUsageChartProps {
  data: ToolStats
  details?: ToolCallDetails[]
}

export function ToolUsageChart({ data, details }: ToolUsageChartProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const maxCount = Math.max(...data.byTool.map((t) => t.count), 1)
  const topTools = data.byTool.slice(0, 10) // Show top 10 tools

  const toggleExpanded = (tool: string) => {
    const newExpanded = new Set(expandedTools)
    if (newExpanded.has(tool)) {
      newExpanded.delete(tool)
    } else {
      newExpanded.add(tool)
    }
    setExpandedTools(newExpanded)
  }

  const getToolDetails = (tool: string): ToolCallDetails | undefined => {
    return details?.find((d) => d.tool === tool)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

      {/* By Tool (Top 10) with expandable details */}
      {topTools.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Top Tools {details && '(click to expand)'}
          </h3>
          <div className="space-y-0">
            {topTools.map((item) => {
              const isExpanded = expandedTools.has(item.tool)
              const toolDetails = details ? getToolDetails(item.tool) : undefined

              return (
                <div key={item.tool} className="border-b border-border last:border-b-0">
                  <div
                    className={`flex items-center gap-2 py-1 ${
                      details ? 'cursor-pointer hover:bg-secondary/30' : ''
                    }`}
                    onClick={() => details && toggleExpanded(item.tool)}
                  >
                    {details && (
                      <div className="w-4 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className={`${details ? 'w-16' : 'w-20'} text-xs text-muted-foreground truncate`} title={item.tool}>
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

                  {isExpanded && toolDetails && (
                    <div className="px-4 py-2 bg-secondary/20 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">First used:</span> {formatTimestamp(toolDetails.firstUsed)}
                        {' • '}
                        <span className="font-medium">Last used:</span> {formatTimestamp(toolDetails.lastUsed)}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-muted-foreground">
                          Used in {toolDetails.sessions.length} session{toolDetails.sessions.length !== 1 ? 's' : ''}:
                        </h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {toolDetails.sessions.slice(0, 10).map((session) => (
                            <div
                              key={session.sessionId}
                              className="flex items-center gap-3 text-xs"
                            >
                              <span className="font-mono text-muted-foreground">
                                {session.sessionId.slice(0, 8)}
                              </span>
                              <span className="text-muted-foreground">
                                {session.callCount} call{session.callCount !== 1 ? 's' : ''}
                              </span>
                              {session.taskPath && (
                                <Link
                                  to="/tasks/$"
                                  params={{ _splat: session.taskPath }}
                                  search={{ archiveFilter: 'all' }}
                                  className="text-primary hover:underline truncate"
                                >
                                  {session.taskPath.split('/').pop()}
                                </Link>
                              )}
                            </div>
                          ))}
                          {toolDetails.sessions.length > 10 && (
                            <div className="text-xs text-muted-foreground italic">
                              ...and {toolDetails.sessions.length - 10} more sessions
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
