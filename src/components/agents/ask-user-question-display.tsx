/**
 * Specialized display component for AskUserQuestion tool calls
 * Renders questions, options, and headers in a readable format
 */

import { CircleHelp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { TOOL_CATEGORIES } from "@/lib/agent/tool-metadata"

interface QuestionOption {
  label: string
  description?: string
}

interface Question {
  question: string
  header?: string
  options: QuestionOption[]
  multiSelect?: boolean
}

interface AskUserQuestionInput {
  questions?: Question[]
}

interface AskUserQuestionDisplayProps {
  toolInput: unknown
}

export function AskUserQuestionDisplay({ toolInput }: AskUserQuestionDisplayProps) {
  const input = toolInput as AskUserQuestionInput
  const questions = input?.questions ?? []
  const color = TOOL_CATEGORIES.interaction.color

  if (questions.length === 0) {
    // Fallback for unexpected format
    return (
      <div className="border-l-2 pl-2 py-1" style={{ borderLeftColor: color }}>
        <div className="flex items-center gap-1.5 mb-1">
          <CircleHelp className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
          <span className="font-vcr text-[10px]" style={{ color }}>
            AskUserQuestion
          </span>
          <Badge
            variant="outline"
            className="text-[8px] h-4 px-1 border-current/30"
            style={{ color, backgroundColor: `${color}15` }}
          >
            Question
          </Badge>
        </div>
        <pre className="text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="border-l-2 pl-2 py-1" style={{ borderLeftColor: color }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <CircleHelp className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
        <span className="font-vcr text-[10px]" style={{ color }}>
          AskUserQuestion
        </span>
        <Badge
          variant="outline"
          className="text-[8px] h-4 px-1 border-current/30"
          style={{ color, backgroundColor: `${color}15` }}
        >
          Question
        </Badge>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div key={idx} className="space-y-1.5">
            {/* Question header chip */}
            {q.header && (
              <span
                className="inline-block text-[10px] font-vcr px-1.5 py-0.5 rounded"
                style={{ color, backgroundColor: `${color}20` }}
              >
                {q.header}
              </span>
            )}

            {/* Question text */}
            <div className="text-sm text-foreground">{q.question}</div>

            {/* Options */}
            {q.options && q.options.length > 0 && (
              <div className="pl-2 space-y-1">
                {q.options.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-muted/30"
                  >
                    <span className="text-muted-foreground font-mono">
                      {q.multiSelect ? "☐" : "○"}
                    </span>
                    <div>
                      <span className="text-foreground font-medium">{opt.label}</span>
                      {opt.description && (
                        <span className="text-muted-foreground ml-2">— {opt.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {q.multiSelect && (
              <div className="text-[10px] text-muted-foreground italic pl-2">
                Multiple selections allowed
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
