/**
 * CommitsList - Recent commit history
 */

import { useState } from 'react'

interface Commit {
  hash: string
  message: string
  author: string
  date: string
}

interface CommitsListProps {
  commits: Commit[]
  isLoading?: boolean
}

export function CommitsList({ commits, isLoading }: CommitsListProps) {
  const [expandedHash, setExpandedHash] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="p-2 text-center text-muted-foreground text-[10px]">
        Loading...
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="p-2 text-center text-muted-foreground text-[10px]">
        No commits
      </div>
    )
  }

  return (
    <div>
      {commits.map((commit) => {
        const isExpanded = expandedHash === commit.hash
        return (
          <div
            key={commit.hash}
            onClick={() => setExpandedHash(isExpanded ? null : commit.hash)}
            className="px-2 py-1.5 hover:bg-secondary transition-colors cursor-pointer border-t border-border/40"
          >
            {/* Compact view */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copyHash(commit.hash)
                }}
                className="font-mono text-[10px] text-primary hover:text-primary/80 cursor-pointer shrink-0"
                title={copiedHash === commit.hash ? 'Copied!' : 'Copy hash'}
              >
                {copiedHash === commit.hash ? '✓' : commit.hash}
              </button>
              <span className={`text-[11px] text-foreground flex-1 ${isExpanded ? '' : 'truncate'}`}>
                {commit.message}
              </span>
              {!isExpanded && (
                <span className="text-[9px] text-muted-foreground shrink-0">{commit.date}</span>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-1 pl-[52px] text-[10px] text-muted-foreground">
                <span>{commit.author}</span>
                <span className="mx-1">·</span>
                <span>{commit.date}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact version for sidebar use
 */
export function CommitsListCompact({ commits, isLoading }: CommitsListProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const copyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="p-2 text-center text-muted-foreground text-xs">Loading...</div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="p-2 text-center text-muted-foreground text-xs">No commits</div>
    )
  }

  return (
    <div className="space-y-1">
      {commits.slice(0, 5).map((commit) => (
        <div
          key={commit.hash}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary transition-colors"
        >
          <button
            onClick={() => copyHash(commit.hash)}
            className="font-mono text-xs text-primary hover:text-primary/80 cursor-pointer"
            title={copiedHash === commit.hash ? 'Copied!' : 'Click to copy'}
          >
            {copiedHash === commit.hash ? '...' : commit.hash}
          </button>
          <span className="flex-1 text-xs text-muted-foreground truncate">
            {commit.message}
          </span>
        </div>
      ))}
    </div>
  )
}
