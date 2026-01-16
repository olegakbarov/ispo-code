/**
 * HotFilesTable Component
 *
 * Displays files ranked by edit frequency with expandable session details.
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { match } from 'ts-pattern'
import { FileCode, ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react'

interface HotFile {
  path: string
  editCount: number
  lastModified: string
  operations: {
    create: number
    edit: number
    delete: number
  }
  sessions: Array<{
    sessionId: string
    taskPath?: string
    editCount: number
  }>
}

interface HotFilesTableProps {
  data: HotFile[]
}

type SortField = 'path' | 'editCount' | 'lastModified'
type SortDirection = 'asc' | 'desc'

export function HotFilesTable({ data }: HotFilesTableProps) {
  const [sortField, setSortField] = useState<SortField>('editCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(20)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const sortedData = [...data].sort((a, b) => {
    const comparison = match(sortField)
      .with('path', () => a.path.localeCompare(b.path))
      .with('editCount', () => a.editCount - b.editCount)
      .with('lastModified', () => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime())
      .exhaustive()

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const displayedData = sortedData.slice(0, limit)
  const hasMore = sortedData.length > limit

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getOperationBreakdown = (operations: HotFile['operations']) => {
    const parts: string[] = []
    if (operations.create > 0) parts.push(`${operations.create} create`)
    if (operations.edit > 0) parts.push(`${operations.edit} edit`)
    if (operations.delete > 0) parts.push(`${operations.delete} delete`)
    return parts.join(', ')
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <FileCode className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-muted-foreground">No file changes yet</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Hot Files</h2>
        <p className="text-sm text-muted-foreground">
          Files ranked by edit frequency ({data.length.toLocaleString()} unique files)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 w-8"></th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('path')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  File Path
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('editCount')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Edit Count
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">Operations</span>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('lastModified')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Last Modified
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">Sessions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedData.map((file) => {
              const isExpanded = expandedPaths.has(file.path)
              return (
                <>
                  <tr
                    key={file.path}
                    className="border-b border-border hover:bg-secondary/30 cursor-pointer"
                    onClick={() => toggleExpanded(file.path)}
                  >
                    <td className="px-4 py-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-xs">{file.path}</code>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-500">
                        {file.editCount}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">
                        {getOperationBreakdown(file.operations)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(file.lastModified)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">
                        {file.sessions.length} session{file.sessions.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${file.path}-expanded`}>
                      <td colSpan={6} className="px-4 py-2 bg-secondary/20">
                        <div className="pl-8 space-y-1">
                          <h4 className="text-xs font-medium text-muted-foreground mb-2">
                            Sessions that modified this file:
                          </h4>
                          {file.sessions.map((session) => (
                            <div
                              key={session.sessionId}
                              className="flex items-center gap-4 text-xs py-1"
                            >
                              <Link
                                to="/agents/$sessionId"
                                params={{ sessionId: session.sessionId }}
                                className="text-primary hover:underline font-mono"
                              >
                                {session.sessionId.slice(0, 8)}
                              </Link>
                              <span className="text-muted-foreground">
                                {session.editCount} edit{session.editCount !== 1 ? 's' : ''}
                              </span>
                              {session.taskPath && (
                                <Link
                                  to="/tasks/$"
                                  params={{ _splat: session.taskPath }}
                                  search={{ archiveFilter: 'all' }}
                                  className="text-primary hover:underline"
                                >
                                  {session.taskPath.split('/').pop()}
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
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
