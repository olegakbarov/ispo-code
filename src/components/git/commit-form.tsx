/**
 * CommitForm - Commit message input and submit button
 */

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'

interface CommitFormProps {
  hasStagedChanges: boolean
  onCommit: (message: string) => Promise<{ success: boolean; hash?: string; error?: string }>
}

export function CommitForm({ hasStagedChanges, onCommit }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [lastCommit, setLastCommit] = useState<{ hash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Clear success message after 5 seconds
  useEffect(() => {
    if (lastCommit) {
      const timer = setTimeout(() => setLastCommit(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [lastCommit])

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
    <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-border bg-card">
      <div className="mb-1 flex items-center justify-between">
        <label className="font-vcr text-[10px] text-muted-foreground">Commit Message</label>
        <span
          className={`font-vcr text-[10px] ${
            isOverLimit ? 'text-chart-4' : 'text-muted-foreground'
          }`}
        >
          {charCount}/72
        </span>
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          hasStagedChanges
            ? 'Enter commit message...'
            : 'Stage files first to commit'
        }
        disabled={!hasStagedChanges || isCommitting}
        rows={2}
        variant="sm"
        className="bg-background"
      />

      {/* Error message */}
      {error && (
        <div className="mt-1 text-[10px] text-destructive font-vcr">{error}</div>
      )}

      {/* Success message */}
      {lastCommit && (
        <div className="mt-1 text-[10px] text-primary font-vcr">
          Committed: {lastCommit.hash}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1 bg-primary text-primary-foreground font-vcr text-[10px] rounded cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </form>
  )
}
