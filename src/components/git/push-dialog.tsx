/**
 * PushDialog - Push current branch to a remote
 *
 * Props-based version (no tRPC dependency)
 */

import { useEffect, useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'

interface GitStatus {
  branch: string
  ahead: number
  behind: number
}

interface RemotesData {
  remotes: string[]
  upstream: string | null
  defaultRemote: string
}

interface PushResult {
  success: boolean
  output?: string
  error?: string
}

interface PushDialogProps {
  status: GitStatus
  remotesData?: RemotesData
  isLoadingRemotes?: boolean
  remotesError?: string | null
  onFetchRemotes?: () => void
  onPush?: (params: { remote?: string; setUpstream: boolean }) => Promise<PushResult>
  onPushed?: () => void
}

function parseUpstreamRemote(upstream: string | null | undefined) {
  if (!upstream) return null
  const idx = upstream.indexOf('/')
  if (idx <= 0) return null
  return upstream.slice(0, idx)
}

export function PushDialog({
  status,
  remotesData,
  isLoadingRemotes,
  remotesError,
  onFetchRemotes,
  onPush,
  onPushed,
}: PushDialogProps) {
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState('')
  const [setUpstream, setSetUpstream] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPushing, setIsPushing] = useState(false)

  const remotes = remotesData?.remotes ?? []
  const upstream = remotesData?.upstream ?? null
  const upstreamRemote = parseUpstreamRemote(upstream)
  const defaultRemote = remotesData?.defaultRemote ?? remotes[0] ?? ''

  const canOpen = Boolean(status.branch && status.branch !== 'HEAD')
  const canPush = useMemo(() => {
    if (!status.branch || status.branch === 'HEAD') return false
    if (isPushing) return false
    if (setUpstream && !remote.trim()) return false
    return true
  }, [isPushing, remote, setUpstream, status.branch])

  // Initialize defaults when opening the dialog or when remotes load
  useEffect(() => {
    if (!open) return
    if (remote.trim()) return
    const nextRemote = upstreamRemote || defaultRemote
    if (nextRemote) setRemote(nextRemote)
  }, [defaultRemote, open, remote, upstreamRemote])

  useEffect(() => {
    if (!open) return
    setSetUpstream(!upstream)
  }, [open, upstream])

  const openDialog = () => {
    setOutput(null)
    setError(null)
    setRemote(upstreamRemote || defaultRemote)
    setSetUpstream(!upstream)
    setOpen(true)
    onFetchRemotes?.()
  }

  const closeDialog = () => {
    if (isPushing) return
    setOpen(false)
  }

  const handlePush = async () => {
    if (!onPush) return

    setOutput(null)
    setError(null)
    setIsPushing(true)

    const remoteTrimmed = remote.trim()
    const remoteToSend =
      upstream && !setUpstream && upstreamRemote && remoteTrimmed === upstreamRemote
        ? undefined
        : remoteTrimmed

    try {
      const result = await onPush({
        remote: remoteToSend ? remoteToSend : undefined,
        setUpstream,
      })

      setOutput(result.output || null)
      if (result.success) {
        setError(null)
        onPushed?.()
        onFetchRemotes?.()
      } else {
        setError(result.error || 'Push failed.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsPushing(false)
    }
  }

  const ahead = status.ahead ?? 0
  const behind = status.behind ?? 0
  const pushLabel = ahead > 0 ? `Push ↑${ahead}` : 'Push'

  return (
    <>
      <button
        onClick={openDialog}
        disabled={!canOpen}
        className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        title={canOpen ? 'Push current branch' : 'No current branch to push'}
      >
        {pushLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-card border border-border rounded shadow-lg">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div>
                <div className="font-vcr text-sm text-primary">Push</div>
                <div className="text-[10px] text-muted-foreground">
                  Branch: <span className="text-foreground">{status.branch || '—'}</span>
                  {upstream ? (
                    <>
                      {' '}· Upstream:{' '}
                      <span className="text-foreground">{upstream}</span>
                    </>
                  ) : (
                    <>
                      {' '}· <span className="text-chart-4">No upstream</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={closeDialog}
                disabled={isPushing}
                className="px-2 py-1 rounded text-xs font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              {(ahead > 0 || behind > 0) && (
                <div className="flex items-center gap-2 text-[10px] font-vcr">
                  {ahead > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">↑{ahead} ahead</span>
                  )}
                  {behind > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-chart-4/20 text-chart-4">↓{behind} behind</span>
                  )}
                </div>
              )}

              <div>
                <div className="font-vcr text-xs text-muted-foreground mb-2">Remote</div>
                {remotes.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {isLoadingRemotes ? 'Loading remotes…' : 'No remotes found.'}
                  </div>
                ) : (
                  <Select
                    value={remote}
                    onChange={(e) => setRemote(e.target.value)}
                    variant="sm"
                    className="bg-background"
                  >
                    {remotes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {!upstream && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <Checkbox
                    checked={setUpstream}
                    onChange={(e) => setSetUpstream(e.target.checked)}
                    size="sm"
                  />
                  Set upstream (-u)
                </label>
              )}

              {remotesError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                  {remotesError}
                </div>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {output && (
                <pre className="max-h-56 overflow-auto bg-background border border-border rounded p-3 text-[10px] text-muted-foreground whitespace-pre-wrap">
                  {output}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={closeDialog}
                disabled={isPushing}
                className="px-3 py-2 bg-background border border-border rounded text-sm font-vcr text-muted-foreground hover:border-foreground cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={handlePush}
                disabled={!canPush || (remotes.length === 0 && !upstream)}
                className="px-3 py-2 bg-primary text-background rounded text-sm font-vcr cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? 'Pushing…' : 'Push'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
