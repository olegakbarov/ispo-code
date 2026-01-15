/**
 * FileChangesTable Component
 *
 * Displays all file changes across sessions in a sortable table.
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FileCode, FilePlus, FileX, ArrowUpDown } from 'lucide-react'

interface FileChangeRecord {
  path: string
  operation: "create" | "edit" | "delete"
  timestamp: string
  toolUsed: string
  sessionId: string
  taskPath?: string
}

interface FileChangesTableProps {
  data: FileChangeRecord[]
}

type SortField = 'path' | 'operation' | 'timestamp' | 'tool'
type SortDirection = 'asc' | 'desc'

export function FileChangesTable({ data }: FileChangesTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp')
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
    let comparison = 0

    switch (sortField) {
      case 'path':
        comparison = a.path.localeCompare(b.path)
        break
      case 'operation':
        comparison = a.operation.localeCompare(b.operation)
        break
      case 'timestamp':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        break
      case 'tool':
        comparison = a.toolUsed.localeCompare(b.toolUsed)
        break
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })

  const displayedData = sortedData.slice(0, limit)
  const hasMore = sortedData.length > limit

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'create':
        return <FilePlus className="h-4 w-4 text-green-500" />
      case 'delete':
        return <FileX className="h-4 w-4 text-red-500" />
      default:
        return <FileCode className="h-4 w-4 text-blue-500" />
    }
  }

  const getOperationBadge = (operation: string) => {
    const colors = {
      create: 'bg-green-500/10 text-green-500 border-green-500/20',
      edit: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      delete: 'bg-red-500/10 text-red-500 border-red-500/20',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colors[operation as keyof typeof colors]}`}>
        {getOperationIcon(operation)}
        {operation}
      </span>
    )
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
        <h2 className="text-lg font-semibold">File Changes</h2>
        <p className="text-sm text-muted-foreground">
          {data.length.toLocaleString()} files changed across all sessions
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
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
                  onClick={() => handleSort('operation')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Operation
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('tool')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Tool
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2">
                <button
                  onClick={() => handleSort('timestamp')}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Timestamp
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                Task
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedData.map((file, idx) => (
              <tr key={`${file.sessionId}-${file.path}-${idx}`} className="border-b border-border hover:bg-secondary/30">
                <td className="px-4 py-2">
                  <code className="text-xs">{file.path}</code>
                </td>
                <td className="px-4 py-2">
                  {getOperationBadge(file.operation)}
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs text-muted-foreground">{file.toolUsed}</span>
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs text-muted-foreground">{formatTimestamp(file.timestamp)}</span>
                </td>
                <td className="px-4 py-2">
                  {file.taskPath ? (
                    <Link
                      to="/tasks/$"
                      params={{ _splat: file.taskPath }}
                      search={{ archiveFilter: 'all' }}
                      className="text-xs text-primary hover:underline"
                    >
                      {file.taskPath.split('/').pop()}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
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
