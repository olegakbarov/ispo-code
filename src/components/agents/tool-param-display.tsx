/**
 * Tool parameter display utility component
 * Formats tool input parameters in a human-readable way
 */

interface ToolParamDisplayProps {
  toolInput: unknown
  expanded: boolean
}

/**
 * Format parameter value for display
 */
function formatParamValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value === null || value === undefined) {
    return "(empty)"
  }
  return JSON.stringify(value, null, 2)
}

/**
 * Truncate string content for collapsed view
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content
  }
  return content.slice(0, maxLength) + "..."
}

export function ToolParamDisplay({ toolInput, expanded }: ToolParamDisplayProps) {
  // Handle non-object inputs
  if (typeof toolInput !== "object" || toolInput === null) {
    const content = formatParamValue(toolInput)
    const display = expanded ? content : truncateContent(content, 150)
    return <pre className="text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap">{display}</pre>
  }

  // Handle object inputs as key-value pairs
  const params = toolInput as Record<string, unknown>
  const entries = Object.entries(params)

  // Collapse if too many params or content too long
  const shouldTruncate = !expanded && (entries.length > 3 || JSON.stringify(toolInput).length > 150)

  return (
    <div className="space-y-0.5">
      {entries.map(([key, value], idx) => {
        // Skip parameters beyond first 2 if truncated
        if (shouldTruncate && idx >= 2) {
          return null
        }

        const formattedValue = formatParamValue(value)
        const displayValue = shouldTruncate ? truncateContent(formattedValue, 80) : formattedValue

        // Special formatting for common parameters
        const isPath = key === "path" || key === "file"
        const isContent = key === "content" || key === "old" || key === "new"
        const isPattern = key === "pat" || key === "pattern"
        const isCommand = key === "cmd" || key === "command"

        return (
          <div key={key} className="flex gap-1.5 text-xs">
            <span className="text-text-muted font-vcr min-w-[60px]">{key}:</span>
            <span
              className={`text-text-secondary flex-1 overflow-x-auto ${
                isContent && !shouldTruncate ? "whitespace-pre-wrap" : "truncate"
              } ${isPath ? "text-accent" : ""} ${isCommand ? "text-warning" : ""} ${isPattern ? "text-info" : ""}`}
            >
              {displayValue}
            </span>
          </div>
        )
      })}
      {shouldTruncate && entries.length > 2 && (
        <div className="text-xs text-text-muted italic">+{entries.length - 2} more parameters</div>
      )}
    </div>
  )
}
