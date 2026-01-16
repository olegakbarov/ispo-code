/**
 * FAQ Documentation Route - Renders the FAQ markdown from docs/FAQ.md
 */

import { createFileRoute } from "@tanstack/react-router"
import { StreamingMarkdown } from "@/components/ui/streaming-markdown"
import faqContent from "../../../docs/FAQ.md?raw"

export const Route = createFileRoute("/docs/faq")({
  component: FAQPage,
})

function FAQPage() {
  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto">
      <StreamingMarkdown
        content={faqContent}
        className="prose prose-invert prose-sm"
        skipSanitization
      />
    </div>
  )
}
