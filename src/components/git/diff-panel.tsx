/**
 * DiffPanel - Displays file diff for selected file (with inline comments)
 *
 * Adapted from tRPC version to use props for data/callbacks
 */

import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { match } from 'ts-pattern'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import type { AgentType } from '@/lib/agent/types'
import { getModelsForAgentType, supportsModelSelection, getDefaultModelId, agentTypeLabel } from '@/lib/agent/config'

// Lazy load MultiFileDiff to avoid SSR issues with lru_map ESM interop
const MultiFileDiff = lazy(() =>
  import('@pierre/diffs/react').then((mod) => ({ default: mod.MultiFileDiff }))
)

type GitDiffView = 'staged' | 'working'
type CommentSide = 'additions' | 'deletions'
type ThemeType = 'dark' | 'light'

export interface DiffData {
  oldContent: string
  newContent: string
  isBinary?: boolean
  isDeleted?: boolean
  isImage?: boolean
}

type GitFileStatusType = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'

export interface GitStatus {
  staged: Array<{ file: string; status: GitFileStatusType }>
  modified: Array<{ file: string; status: GitFileStatusType }>
  untracked: string[]
}

interface LineComment {
  id: string
  side: CommentSide
  lineNumber: number
  body: string
  createdAt: string
  updatedAt?: string
}

interface CommentDraft {
  file: string
  view: GitDiffView
  side: CommentSide
  lineNumber: number
  body: string
  editingId?: string
}

interface DiffPanelProps {
  status: GitStatus
  openFiles: string[]
  activeFile: string | null
  activeView: GitDiffView
  fileViews: Record<string, GitDiffView>
  /** Diff data for the active file */
  diffData: DiffData | null
  diffLoading?: boolean
  diffError?: string | null
  /** Available agent types */
  availableAgentTypes?: AgentType[]
  /** Theme for diff viewer */
  theme?: ThemeType
  onSelectFile: (file: string) => void
  onCloseFile: (file: string) => void
  onCloseAll: () => void
  onViewChange: (view: GitDiffView) => void
  /** Fetch diff for a file/view - used for building prompt */
  onFetchDiff?: (file: string, view: GitDiffView) => Promise<DiffData>
  /** Called when user wants to spawn an agent */
  onSpawnAgent?: (params: { prompt: string; agentType: AgentType; model?: string }) => void
  /** Called if spawn is in progress */
  isSpawning?: boolean
  spawnError?: string | null
}

function fileBaseName(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function commentKey(file: string, view: GitDiffView) {
  return `${view}:${file}`
}

function parseCommentKey(key: string): { file: string; view: GitDiffView } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const view = key.slice(0, idx)
  if (view !== 'working' && view !== 'staged') return null
  return { view, file: key.slice(idx + 1) }
}

function generateId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function guessCodeBlockLanguage(file: string) {
  const ext = file.split('.').pop()?.toLowerCase()
  return match(ext)
    .with('ts', 'tsx', () => 'ts')
    .with('js', 'jsx', () => 'js')
    .with('json', () => 'json')
    .with('md', () => 'md')
    .with('css', () => 'css')
    .with('html', () => 'html')
    .with('yml', 'yaml', () => 'yaml')
    .with('sh', 'bash', () => 'bash')
    .otherwise(() => '')
}

function splitLines(text: string) {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function formatNumberedLines(lines: string[], startLineNumber = 1) {
  const end = startLineNumber + lines.length - 1
  const width = Math.max(1, String(end).length)
  return lines
    .map((line, idx) => `${String(startLineNumber + idx).padStart(width)}| ${line}`)
    .join('\n')
}

function buildSnippetRanges(
  lineNumbers: number[],
  totalLines: number,
  contextLines: number
) {
  const uniqueSorted = Array.from(new Set(lineNumbers))
    .filter((n) => n >= 1 && n <= totalLines)
    .sort((a, b) => a - b)

  const ranges: Array<{ start: number; end: number }> = []

  for (const lineNumber of uniqueSorted) {
    const start = Math.max(1, lineNumber - contextLines)
    const end = Math.min(totalLines, lineNumber + contextLines)

    const last = ranges[ranges.length - 1]
    if (!last) {
      ranges.push({ start, end })
      continue
    }

    if (start <= last.end + 1) {
      last.end = Math.max(last.end, end)
      continue
    }

    ranges.push({ start, end })
  }

  return ranges
}

export function DiffPanel({
  status,
  openFiles,
  activeFile,
  activeView,
  fileViews,
  diffData,
  diffLoading,
  diffError,
  availableAgentTypes = [],
  theme = 'dark',
  onSelectFile,
  onCloseFile,
  onCloseAll,
  onViewChange,
  onFetchDiff,
  onSpawnAgent,
  isSpawning,
  spawnError,
}: DiffPanelProps) {
  const [commentsByKey, setCommentsByKey] = useState<Record<string, LineComment[]>>({})
  const [draft, setDraft] = useState<CommentDraft | null>(null)

  const [sendOpen, setSendOpen] = useState(false)
  const [sendKeys, setSendKeys] = useState<Set<string>>(new Set())
  const [includeFullFile, setIncludeFullFile] = useState(false)
  const [instructions, setInstructions, clearInstructionsDraft] = useTextareaDraft('diff-panel-instructions')
  const [agentType, setAgentType] = useState<AgentType>('claude')
  const [model, setModel] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false)

  useEffect(() => {
    if (availableAgentTypes.length === 0) return
    if (!availableAgentTypes.includes(agentType)) {
      setAgentType(availableAgentTypes[0])
    }
  }, [availableAgentTypes, agentType])

  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const file of openFiles) {
      const view = fileViews[file] ?? 'working'
      counts[file] = commentsByKey[commentKey(file, view)]?.length ?? 0
    }
    return counts
  }, [commentsByKey, fileViews, openFiles])

  const commentedEntries = useMemo(() => {
    const entries: Array<{ key: string; file: string; view: GitDiffView; count: number }> = []
    for (const [key, comments] of Object.entries(commentsByKey)) {
      const parsed = parseCommentKey(key)
      if (!parsed) continue
      const count = comments.length
      if (count === 0) continue
      entries.push({ key, file: parsed.file, view: parsed.view, count })
    }
    entries.sort((a, b) => (a.file === b.file ? a.view.localeCompare(b.view) : a.file.localeCompare(b.file)))
    return entries
  }, [commentsByKey])

  const { toAgentFileCount, toAgentCommentCount } = useMemo(() => {
    const uniqueFiles = new Set(commentedEntries.map((e) => e.file))
    const total = commentedEntries.reduce((sum, e) => sum + e.count, 0)
    return { toAgentFileCount: uniqueFiles.size, toAgentCommentCount: total }
  }, [commentedEntries])

  const activeComments = useMemo(() => {
    if (!activeFile) return []
    return commentsByKey[commentKey(activeFile, activeView)] ?? []
  }, [activeFile, activeView, commentsByKey])

  const commentsByLineKey = useMemo(() => {
    const map = new Map<string, LineComment[]>()
    for (const comment of activeComments) {
      const key = `${comment.side}:${comment.lineNumber}`
      const arr = map.get(key)
      if (arr) arr.push(comment)
      else map.set(key, [comment])
    }
    return map
  }, [activeComments])

  const lineAnnotations = useMemo(() => {
    const annotations: Array<{ side: CommentSide; lineNumber: number; metadata: null }> = []
    for (const key of commentsByLineKey.keys()) {
      const [side, lineNumberStr] = key.split(':')
      const lineNumber = Number(lineNumberStr)
      if ((side === 'additions' || side === 'deletions') && Number.isFinite(lineNumber)) {
        annotations.push({ side, lineNumber, metadata: null })
      }
    }

    if (
      draft &&
      activeFile &&
      draft.file === activeFile &&
      draft.view === activeView &&
      Number.isFinite(draft.lineNumber)
    ) {
      annotations.push({ side: draft.side, lineNumber: draft.lineNumber, metadata: null })
    }

    const uniq = new Map<string, { side: CommentSide; lineNumber: number; metadata: null }>()
    for (const a of annotations) {
      uniq.set(`${a.side}:${a.lineNumber}`, a)
    }

    const uniqueAnnotations = Array.from(uniq.values())
    uniqueAnnotations.sort((a, b) =>
      a.lineNumber === b.lineNumber ? a.side.localeCompare(b.side) : a.lineNumber - b.lineNumber
    )
    return uniqueAnnotations
  }, [activeFile, activeView, commentsByLineKey, draft])

  const hasStaged = activeFile ? status.staged.some((f) => f.file === activeFile) : false
  const hasWorking = activeFile
    ? status.modified.some((f) => f.file === activeFile) || status.untracked.includes(activeFile)
    : false
  const canToggleView = hasStaged && hasWorking

  const handleLineClick = useCallback(
    (props: { lineNumber: number; annotationSide: CommentSide }) => {
      if (!activeFile) return
      setDraft({
        file: activeFile,
        view: activeView,
        side: props.annotationSide,
        lineNumber: props.lineNumber,
        body: '',
      })
    },
    [activeFile, activeView]
  )

  // Close drafts when switching files/views
  useEffect(() => {
    setDraft(null)
  }, [activeFile, activeView])

  const saveDraft = () => {
    if (!draft) return
    const body = draft.body.trim()
    if (!body) return

    const key = commentKey(draft.file, draft.view)

    setCommentsByKey((prev) => {
      const current = prev[key] ?? []
      const now = new Date().toISOString()

      if (draft.editingId) {
        return {
          ...prev,
          [key]: current.map((c) =>
            c.id === draft.editingId ? { ...c, body, updatedAt: now } : c
          ),
        }
      }

      const next: LineComment = {
        id: generateId(),
        side: draft.side,
        lineNumber: draft.lineNumber,
        body,
        createdAt: now,
      }
      return { ...prev, [key]: [...current, next] }
    })

    setDraft(null)
  }

  const deleteComment = (file: string, view: GitDiffView, id: string) => {
    const key = commentKey(file, view)
    setCommentsByKey((prev) => {
      const current = prev[key]
      if (!current) return prev
      const next = current.filter((c) => c.id !== id)
      return { ...prev, [key]: next }
    })
  }

  const openSendModal = () => {
    const initial = new Set<string>(commentedEntries.map((e) => e.key))
    setSendKeys(initial)
    setSendError(null)
    setSendOpen(true)
  }

  const openSendModalForActiveFile = () => {
    if (!activeFile) return
    const key = commentKey(activeFile, activeView)
    const count = commentsByKey[key]?.length ?? 0
    if (count === 0) {
      openSendModal()
      return
    }
    setSendKeys(new Set([key]))
    setSendError(null)
    setSendOpen(true)
  }

  const toggleSendKey = (key: string) => {
    setSendKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const buildPrompt = useCallback(
    async (keys: string[]) => {
      if (!onFetchDiff) throw new Error('onFetchDiff not provided')

      const filePayloads = await Promise.all(
        keys.map(async (key) => {
          const parsed = parseCommentKey(key)
          if (!parsed) throw new Error(`Invalid comment key: ${key}`)
          const { file, view } = parsed
          const diff = await onFetchDiff(file, view)
          const comments = commentsByKey[key] ?? []
          return { file, view, diff, comments }
        })
      )

      const sections: string[] = []
      if (instructions.trim()) {
        sections.push(instructions.trim())
      } else {
        sections.push(
          'Please review and address the inline comments below. Respond with concrete code changes or a patch.'
        )
      }

      sections.push(`Context: ${filePayloads.length} file(s) with comments.`)

      for (const payload of filePayloads) {
        const fileLang = guessCodeBlockLanguage(payload.file)
        const comments = payload.comments
          .slice()
          .sort((a, b) =>
            a.lineNumber === b.lineNumber ? a.side.localeCompare(b.side) : a.lineNumber - b.lineNumber
          )

        const oldLines = splitLines(payload.diff.oldContent)
        const newLines = splitLines(payload.diff.newContent)

        const additionCommentLines = comments
          .filter((c) => c.side === 'additions')
          .map((c) => c.lineNumber)
        const deletionCommentLines = comments
          .filter((c) => c.side === 'deletions')
          .map((c) => c.lineNumber)

        const newRanges =
          newLines.length === 0
            ? []
            : includeFullFile
              ? [{ start: 1, end: newLines.length }]
              : buildSnippetRanges(additionCommentLines, newLines.length, 6)

        const oldRanges =
          oldLines.length === 0
            ? []
            : includeFullFile
              ? deletionCommentLines.length > 0
                ? buildSnippetRanges(deletionCommentLines, oldLines.length, 6)
                : []
              : buildSnippetRanges(deletionCommentLines, oldLines.length, 6)

        sections.push(`---\nFile: ${payload.file}\nView: ${payload.view}`)

        if (payload.diff.isDeleted) {
          sections.push('Note: file is deleted in this view; showing last known contents.')
        }

        if (newLines.length === 0 && oldLines.length === 0) {
          sections.push('```text\n<empty file>\n```')
        } else if (payload.diff.isDeleted && oldLines.length > 0) {
          for (const range of includeFullFile ? [{ start: 1, end: oldLines.length }] : oldRanges) {
            const slice = oldLines.slice(range.start - 1, range.end)
            const numbered = formatNumberedLines(slice, range.start)
            const langFence = fileLang ? fileLang : 'text'
            const header = includeFullFile
              ? 'Full file (old)'
              : `Old snippet L${range.start}-L${range.end}`
            sections.push(`${header}:\n\`\`\`${langFence}\n${numbered}\n\`\`\``)
          }
        } else {
          if (newLines.length > 0) {
            for (const range of includeFullFile ? [{ start: 1, end: newLines.length }] : newRanges) {
              const slice = newLines.slice(range.start - 1, range.end)
              const numbered = formatNumberedLines(slice, range.start)
              const langFence = fileLang ? fileLang : 'text'
              const header = includeFullFile
                ? 'Full file'
                : `Snippet L${range.start}-L${range.end}`
              sections.push(`${header}:\n\`\`\`${langFence}\n${numbered}\n\`\`\``)
            }
          }

          if (oldRanges.length > 0) {
            for (const range of oldRanges) {
              const slice = oldLines.slice(range.start - 1, range.end)
              const numbered = formatNumberedLines(slice, range.start)
              const langFence = fileLang ? fileLang : 'text'
              sections.push(`Old snippet L${range.start}-L${range.end}:\n\`\`\`${langFence}\n${numbered}\n\`\`\``)
            }
          }
        }

        const grouped: Record<string, LineComment[]> = {}
        for (const c of comments) {
          const k = `${c.side}:${c.lineNumber}`
          grouped[k] ??= []
          grouped[k].push(c)
        }

        const commentLines: string[] = []
        for (const key of Object.keys(grouped).sort((a, b) => {
          const [as, al] = a.split(':')
          const [bs, bl] = b.split(':')
          const an = Number(al)
          const bn = Number(bl)
          if (an !== bn) return an - bn
          return as.localeCompare(bs)
        })) {
          const [side, ln] = key.split(':')
          const lineNumber = Number(ln)
          for (const c of grouped[key]) {
            commentLines.push(`- L${lineNumber} (${side}): ${c.body}`)
          }
        }

        sections.push(`Comments:\n${commentLines.join('\n')}`)
      }

      return sections.join('\n\n')
    },
    [commentsByKey, includeFullFile, instructions, onFetchDiff]
  )

  const handleSendToAgent = async () => {
    const keys = Array.from(sendKeys)
    if (keys.length === 0 || !onSpawnAgent) return

    setSendError(null)
    setIsBuildingPrompt(true)

    try {
      const prompt = await buildPrompt(keys)
      setIsBuildingPrompt(false)
      onSpawnAgent({
        prompt,
        agentType,
        model: model || undefined,
      })
      // Clear instructions draft on successful send
      clearInstructionsDraft()
      setSendOpen(false)
    } catch (err) {
      setSendError((err as Error).message ?? 'Failed to build prompt')
      setIsBuildingPrompt(false)
    }
  }

  const isAvailable = (type: AgentType) => availableAgentTypes.includes(type)

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col">

      {!activeFile ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a file to view diff
        </div>
      ) : diffLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading diff...
        </div>
      ) : diffError ? (
        <div className="flex-1 flex items-center justify-center text-destructive text-sm">
          Error loading diff: {diffError}
        </div>
      ) : !diffData ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No diff data
        </div>
      ) : diffData.isImage ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {diffData.oldContent && (
              <div className="space-y-2">
                <div className="text-sm font-vcr text-muted-foreground">Before (HEAD)</div>
                <div className="border border-border rounded-lg p-4 bg-background flex items-center justify-center">
                  <img
                    src={diffData.oldContent}
                    alt="Before"
                    className="max-w-full max-h-[600px] object-contain"
                  />
                </div>
              </div>
            )}
            {diffData.newContent && (
              <div className="space-y-2">
                <div className="text-sm font-vcr text-muted-foreground">
                  {diffData.oldContent ? "After (Current)" : "New Image"}
                </div>
                <div className="border border-border rounded-lg p-4 bg-background flex items-center justify-center">
                  <img
                    src={diffData.newContent}
                    alt="After"
                    className="max-w-full max-h-[600px] object-contain"
                  />
                </div>
              </div>
            )}
            {!diffData.oldContent && !diffData.newContent && (
              <div className="text-muted-foreground text-sm text-center">
                No image content available
              </div>
            )}
          </div>
        </div>
      ) : diffData.isBinary ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Binary file - cannot display diff
        </div>
      ) : (
        <div className="flex-1 min-h-0 min-w-0 overflow-auto">
          {(toAgentCommentCount > 0 || (activeFile && (commentsByKey[commentKey(activeFile, activeView)]?.length ?? 0) > 0)) && (
            <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {activeFile ? (
                    <div className="font-vcr text-[10px] text-muted-foreground truncate">
                      {activeFile}
                    </div>
                  ) : (
                    <div className="font-vcr text-[10px] text-muted-foreground">
                      Comments
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {activeFile
                      ? `${commentsByKey[commentKey(activeFile, activeView)]?.length ?? 0} in this file · ${toAgentCommentCount} total`
                      : `${toAgentCommentCount} total`}
                  </div>
                </div>

                {activeFile && (commentsByKey[commentKey(activeFile, activeView)]?.length ?? 0) > 0 && (
                  <button
                    onClick={openSendModalForActiveFile}
                    aria-label={`Submit ${commentsByKey[commentKey(activeFile, activeView)]?.length ?? 0} comments for current file`}
                    className="px-2 py-1 rounded text-[10px] font-vcr bg-primary text-primary-foreground cursor-pointer hover:opacity-90 whitespace-nowrap"
                    title="Submit comments for this file"
                  >
                    Submit file
                  </button>
                )}

                {toAgentCommentCount > 0 && (
                  <button
                    onClick={openSendModal}
                    aria-label={`Submit all ${toAgentCommentCount} comments from ${toAgentFileCount} files`}
                    className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors whitespace-nowrap"
                    title="Submit all commented files"
                  >
                    Submit all ({toAgentCommentCount})
                  </button>
                )}
              </div>
            </div>
          )}

          <Suspense fallback={<div className="p-4 text-muted-foreground text-sm">Loading diff viewer...</div>}>
          <MultiFileDiff
            className="block w-full min-w-0"
            oldFile={{ name: activeFile, contents: diffData.oldContent }}
            newFile={{ name: activeFile, contents: diffData.newContent }}
            lineAnnotations={lineAnnotations}
            renderAnnotation={(annotation) => {
              const key = `${annotation.side}:${annotation.lineNumber}`
              const list = commentsByLineKey.get(key) ?? []
              const view = activeView
              const file = activeFile
              if (!file) return null

              const isDraftForThisLine =
                !!draft &&
                draft.file === file &&
                draft.view === view &&
                draft.side === annotation.side &&
                draft.lineNumber === annotation.lineNumber

              if (list.length === 0 && !isDraftForThisLine) return null

              return (
                <div
                  className="my-1 rounded border border-border bg-card px-2 py-2 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-vcr text-[10px] text-muted-foreground">
                      {annotation.side} L{annotation.lineNumber}
                      {list.length > 0 ? ` · ${list.length} comment${list.length === 1 ? '' : 's'}` : ''}
                    </div>
                    {!isDraftForThisLine && (
                      <button
                        onClick={() =>
                          setDraft({
                            file,
                            view,
                            side: annotation.side,
                            lineNumber: annotation.lineNumber,
                            body: '',
                          })
                        }
                        className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                      >
                        + Add
                      </button>
                    )}
                  </div>

                  {list.length > 0 && (
                    <div className="space-y-2">
                    {list.map((c) => (
                      <div key={c.id} className="rounded bg-background border border-border px-2 py-1.5">
                        <div className="text-xs text-foreground whitespace-pre-wrap">
                          {c.body}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            onClick={() =>
                              setDraft({
                                file,
                                view,
                                side: c.side,
                                lineNumber: c.lineNumber,
                                body: c.body,
                                editingId: c.id,
                              })
                            }
                            className="text-[10px] font-vcr text-muted-foreground hover:text-primary cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteComment(file, view, c.id)}
                            className="text-[10px] font-vcr text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {isDraftForThisLine && draft && (
                    <div className="rounded bg-background border border-border px-2 py-2">
                      <div className="font-vcr text-[10px] text-muted-foreground">
                        {draft.editingId ? 'Edit comment' : 'New comment'}
                      </div>
                      <Textarea
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        placeholder="Write a comment for the agent..."
                        autoFocus
                        variant="sm"
                        className="mt-1 min-h-20 bg-card resize-y"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDraft(null)}
                          className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveDraft}
                          disabled={!draft.body.trim()}
                          className="px-2 py-1 rounded text-[10px] font-vcr bg-primary text-primary-foreground cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            }}
            options={{
              diffStyle: 'unified',
              themeType: theme,
              theme: { dark: 'pierre-dark', light: 'pierre-light' },
              diffIndicators: 'bars',
              overflow: 'scroll',
              disableFileHeader: true,
              onLineClick: ({ lineNumber, annotationSide }) =>
                handleLineClick({ lineNumber, annotationSide }),
            }}
          />
          </Suspense>
        </div>
      )}

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <div className="font-vcr text-sm text-primary">Send to Agent</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Generates a markdown prompt from your commented files
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSpawning) setSendOpen(false)
                }}
                aria-label="Close dialog"
                className="px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
                title="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="font-vcr text-xs text-muted-foreground mb-2">Files</div>
                <div className="max-h-44 overflow-y-auto border border-border rounded bg-background">
                  {commentedEntries.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">No commented files</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {commentedEntries.map((entry) => {
                        const checked = sendKeys.has(entry.key)
                        return (
                          <label
                            key={entry.key}
                            className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary"
                          >
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleSendKey(entry.key)}
                              size="sm"
                            />
                            <span className="flex-1 truncate" title={entry.file}>
                              {entry.file}
                            </span>
                            <span className="text-[10px] font-vcr text-muted-foreground">{entry.view}</span>
                            <span className="text-[10px] font-vcr text-primary">{entry.count}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <Checkbox
                  checked={includeFullFile}
                  onChange={(e) => setIncludeFullFile(e.target.checked)}
                  size="sm"
                />
                Include full file contents (otherwise send snippets around comments)
              </label>

              <div>
                <div className="font-vcr text-xs text-muted-foreground mb-2">Agent Type</div>
                <div className="flex gap-2 flex-wrap">
                  {(['cerebras', 'gemini', 'opencode', 'claude', 'codex'] as AgentType[]).map((type) => {
                    const available = isAvailable(type)
                    const selected = agentType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          setAgentType(type)
                          setModel(getDefaultModelId(type))
                        }}
                        className={`flex-1 min-w-[80px] px-3 py-2 rounded border cursor-pointer transition-colors text-xs font-vcr ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : available
                              ? 'border-border bg-background text-foreground hover:border-muted-foreground'
                              : 'border-border bg-background text-muted-foreground cursor-not-allowed opacity-50'
                        }`}
                      >
                        {agentTypeLabel[type]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {supportsModelSelection(agentType) && (
                <div>
                  <div className="font-vcr text-xs text-muted-foreground mb-2">Model</div>
                  <Select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    variant="sm"
                    className="bg-background"
                  >
                    {getModelsForAgentType(agentType).map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}{m.description ? ` - ${m.description}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <div className="font-vcr text-xs text-muted-foreground mb-2">Instructions (optional)</div>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="What should the agent do with these comments?"
                  className="min-h-24 bg-background resize-y"
                />
              </div>

              {(sendError || spawnError) && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
                  {sendError || spawnError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => setSendOpen(false)}
                disabled={isSpawning || isBuildingPrompt}
                className="px-3 py-2 bg-background border border-border rounded text-sm font-vcr text-foreground hover:border-muted-foreground cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToAgent}
                disabled={
                  sendKeys.size === 0 ||
                  isSpawning ||
                  isBuildingPrompt ||
                  !isAvailable(agentType) ||
                  !onSpawnAgent
                }
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm font-vcr cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBuildingPrompt || isSpawning ? 'Sending…' : 'Start Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface DiffTabsHeaderProps {
  openFiles: string[]
  activeFile: string | null
  canToggleView: boolean
  activeView: GitDiffView
  commentCounts: Record<string, number>
  toAgentFileCount: number
  toAgentCommentCount: number
  onSelectFile: (file: string) => void
  onCloseFile: (file: string) => void
  onCloseAll: () => void
  onViewChange: (view: GitDiffView) => void
  onOpenSendToAgent: () => void
}

const DiffTabsHeader = memo(function DiffTabsHeader({
  openFiles,
  activeFile,
  canToggleView,
  activeView,
  commentCounts,
  toAgentFileCount,
  toAgentCommentCount,
  onSelectFile,
  onCloseFile,
  onCloseAll,
  onViewChange,
  onOpenSendToAgent,
}: DiffTabsHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex-1 overflow-x-auto" role="tablist" aria-label="Open files">
          <div className="flex items-center gap-1 min-w-fit">
            {openFiles.length === 0 ? (
              <span className="font-vcr text-[10px] text-muted-foreground px-2 py-1">
                No files open
              </span>
            ) : (
              openFiles.map((file) => {
                const isActive = file === activeFile
                const count = commentCounts[file] ?? 0
                return (
                  <div
                    key={file}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`${fileBaseName(file)}${count > 0 ? `, ${count} comments` : ''}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => onSelectFile(file)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectFile(file)
                      }
                    }}
                    className={`group flex items-center gap-1 px-2 py-1 rounded cursor-pointer border transition-colors ${
                      isActive
                        ? 'bg-secondary border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                    title={file}
                  >
                    <span className="text-xs truncate max-w-[220px]">
                      {fileBaseName(file)}
                    </span>
                    {count > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-vcr" aria-hidden="true">
                        {count}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCloseFile(file)
                      }}
                      aria-label={`Close ${fileBaseName(file)}`}
                      className={`ml-1 px-1 text-xs leading-none cursor-pointer transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      } text-muted-foreground hover:text-foreground`}
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {activeFile && canToggleView && (
          <div className="flex items-center gap-1" role="tablist" aria-label="Diff view type">
            <button
              onClick={() => onViewChange('working')}
              role="tab"
              aria-selected={activeView === 'working'}
              aria-label="Show working tree diff"
              className={`px-2 py-1 rounded text-[10px] font-vcr border cursor-pointer transition-colors ${
                activeView === 'working'
                  ? 'border-primary text-primary bg-secondary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              title="Show working tree diff"
            >
              Working
            </button>
            <button
              onClick={() => onViewChange('staged')}
              role="tab"
              aria-selected={activeView === 'staged'}
              aria-label="Show staged diff"
              className={`px-2 py-1 rounded text-[10px] font-vcr border cursor-pointer transition-colors ${
                activeView === 'staged'
                  ? 'border-primary text-primary bg-secondary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              title="Show staged diff"
            >
              Staged
            </button>
          </div>
        )}

        {toAgentFileCount > 0 && (
          <button
            onClick={onOpenSendToAgent}
            aria-label={`Send ${toAgentFileCount} files with ${toAgentCommentCount} comments to agent`}
            className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors whitespace-nowrap"
            title="Send commented files to an agent"
          >
            To Agent ({toAgentFileCount}/{toAgentCommentCount})
          </button>
        )}

        {openFiles.length > 0 && (
          <button
            onClick={onCloseAll}
            aria-label="Close all open files"
            className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors whitespace-nowrap"
            title="Close all diffs"
          >
            Close all
          </button>
        )}
      </div>
    </div>
  )
})
