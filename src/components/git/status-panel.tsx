/**
 * StatusPanel - Displays current branch info and file change counts
 */

interface GitFileStatus {
  file: string
  status: string
}

export interface StatusPanelGitStatus {
  staged: GitFileStatus[]
  modified: GitFileStatus[]
  untracked: string[]
  ahead: number
  behind: number
}

interface StatusPanelProps {
  status: StatusPanelGitStatus
  isLoading?: boolean
}

export function StatusPanel({ status, isLoading }: StatusPanelProps) {
  const { staged, modified, untracked, ahead, behind } = status

  const stats = [
    { label: 'Staged', value: staged.length, color: 'text-primary' },
    { label: 'Modified', value: modified.length, color: 'text-chart-4' },
    { label: 'Untracked', value: untracked.length, color: 'text-muted-foreground' },
  ]

  const totalChanges = staged.length + modified.length + untracked.length
  const isDirty = totalChanges > 0

  return (
    <div className="px-3 py-2 bg-card border-b border-border flex items-center gap-4">
      <div className="flex items-center gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1">
            <span className={`text-sm font-mono ${stat.color}`}>
              {isLoading ? '-' : stat.value}
            </span>
            <span className="font-vcr text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {(ahead > 0 || behind > 0) && (
        <div className="flex items-center gap-1.5 text-xs">
          {ahead > 0 && (
            <span className="px-1 py-0.5 bg-primary/20 text-primary rounded font-vcr text-[10px]">
              ↑{ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="px-1 py-0.5 bg-chart-4/20 text-chart-4 rounded font-vcr text-[10px]">
              ↓{behind}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isDirty ? 'bg-chart-4' : 'bg-primary'
          }`}
        />
        <span className="font-vcr text-xs text-muted-foreground">
          {isDirty ? `${totalChanges} changes` : 'Clean'}
        </span>
      </div>
    </div>
  )
}
