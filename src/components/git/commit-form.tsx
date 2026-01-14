/**
 * CommitForm - Commit message input and submit button
 */

import { useState } from 'react'

interface CommitFormProps {
  hasStagedChanges: boolean
  onCommit: (message: string) => Promise<{ success: boolean; hash?: string; error?: string }>
}

export function CommitForm({ hasStagedChanges, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [lastCommit, setLastCommit] = useState<{ hash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !hasStagedChanges || isCommitting) return

    setIsCommitting(true)
    setError(null)

    try {
      const result = await onCommit(message.trim())
      if (result.success && result.hash) {
        setLastCommit({ hash: result.hash })
        setMessage('')
      } else {
        setError(result.error || 'Commit failed')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCommitting(false)
    }
  }

  const charCount = message.length
  const isOverLimit = charCount > 72 // Conventional first line limit
  const canSubmit = message.trim().length > 0 && hasStagedChanges && !isCommitting

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-border bg-panel">
      <div className="mb-1 flex items-center justify-between">
        <label className="font-vcr text-[10px] text-text-muted">Commit Message</label>
        <span
          className={`font-vcr text-[10px] ${
            isOverLimit ? 'text-warning' : 'text-text-muted'
          }`}
        >
          {charCount}/72
        </span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          hasStagedChanges
            ? 'Enter commit message...'
            : 'Stage files first to commit'
        }
        disabled={!hasStagedChanges || isCommitting}
        rows={2}
        className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {/* Error message */}
      {error && (
        <div className="mt-1 text-[10px] text-error font-vcr">{error}</div>
      )}

      {/* Success message */}
      {lastCommit && (
        <div className="mt-1 text-[10px] text-accent font-vcr">
          Committed: {lastCommit.hash}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1 bg-accent text-background font-vcr text-[10px] rounded cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </form>
  )
}
