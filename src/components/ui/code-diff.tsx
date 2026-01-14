/**
 * CodeDiff - Renders code diffs in agent output and file views
 */

type DiffStyle = 'split' | 'unified'

interface CodeDiffProps {
  /** Old file content */
  oldContent: string
  /** New file content */
  newContent: string
  /** File name for display */
  fileName?: string
  /** Diff display style */
  style?: DiffStyle
  /** Optional className for styling */
  className?: string
}

/**
 * Simple diff line parser
 */
function parseDiffLines(oldContent: string, newContent: string) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const result: Array<{ type: 'same' | 'add' | 'remove'; content: string }> = []

  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx]
    const newLine = newLines[newIdx]

    if (oldLine === newLine) {
      result.push({ type: 'same', content: oldLine ?? '' })
      oldIdx++
      newIdx++
    } else if (oldLine !== undefined && !newLines.includes(oldLine)) {
      result.push({ type: 'remove', content: oldLine })
      oldIdx++
    } else if (newLine !== undefined && !oldLines.includes(newLine)) {
      result.push({ type: 'add', content: newLine })
      newIdx++
    } else {
      if (oldLine !== undefined) {
        result.push({ type: 'remove', content: oldLine })
        oldIdx++
      }
      if (newLine !== undefined) {
        result.push({ type: 'add', content: newLine })
        newIdx++
      }
    }
  }

  return result
}

/**
 * Renders a unified diff view of two file versions
 */
export function CodeDiff({
  oldContent,
  newContent,
  fileName = 'file.txt',
  style: _style = 'unified',
  className = '',
}: CodeDiffProps) {
  const lines = parseDiffLines(oldContent, newContent)

  return (
    <div className={`rounded overflow-hidden bg-background ${className}`}>
      {fileName && (
        <div className="px-3 py-1.5 border-b border-border bg-panel text-xs font-mono text-text-muted">
          {fileName}
        </div>
      )}
      <pre className="p-3 overflow-x-auto text-xs font-mono">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`${
              line.type === 'add'
                ? 'bg-accent/10 text-accent'
                : line.type === 'remove'
                  ? 'bg-error/10 text-error'
                  : 'text-text-secondary'
            }`}
          >
            <span className="inline-block w-4 text-text-muted select-none">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            {line.content}
          </div>
        ))}
      </pre>
    </div>
  )
}

/**
 * Simplified diff for inline display
 */
export function InlineDiff({
  oldText,
  newText,
  className = '',
}: {
  oldText: string
  newText: string
  className?: string
}) {
  if (oldText === newText) {
    return <span className={className}>{newText}</span>
  }

  return (
    <span className={className}>
      {oldText && (
        <span className="line-through text-error opacity-60 mr-1">{oldText}</span>
      )}
      {newText && <span className="text-accent">{newText}</span>}
    </span>
  )
}
