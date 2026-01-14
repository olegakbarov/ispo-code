/**
 * Codebase Map Route - Renders the CODEBASE_MAP.md with Mermaid diagrams
 */

import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc-client"
import { Map, RefreshCw, ExternalLink, ChevronRight, FileText } from "lucide-react"

export const Route = createFileRoute("/map")({
  component: CodebaseMapPage,
})

// Extract frontmatter from markdown
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatterStr = match[1]
  const body = match[2]

  const frontmatter: Record<string, string> = {}
  for (const line of frontmatterStr.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

// Extract table of contents from markdown
function extractToc(content: string): { level: number; text: string; id: string }[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm
  const toc: { level: number; text: string; id: string }[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2]
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    toc.push({ level, text, id })
  }

  return toc
}

// Mermaid diagram component
function MermaidDiagram({ chart, id }: { chart: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const renderChart = async () => {
      // @ts-expect-error mermaid is loaded from CDN
      if (!window.mermaid) return

      try {
        // @ts-expect-error mermaid is loaded from CDN
        const { svg } = await window.mermaid.render(id, chart)
        setSvg(svg)
        setError(null)
      } catch (e) {
        console.error("Mermaid render error:", e)
        setError(String(e))
      }
    }

    // Check if mermaid is loaded
    // @ts-expect-error mermaid is loaded from CDN
    if (window.mermaid) {
      renderChart()
    } else {
      // Wait for mermaid to load
      const checkInterval = setInterval(() => {
        // @ts-expect-error mermaid is loaded from CDN
        if (window.mermaid) {
          clearInterval(checkInterval)
          renderChart()
        }
      }, 100)
      return () => clearInterval(checkInterval)
    }
  }, [chart, id])

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 my-4">
        <p className="text-red-400 text-sm mb-2">Mermaid diagram error:</p>
        <pre className="text-xs text-red-300 overflow-auto">{error}</pre>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show source</summary>
          <pre className="text-xs mt-2 p-2 bg-panel rounded overflow-auto">{chart}</pre>
        </details>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="bg-panel border border-border rounded-lg p-4 my-4 text-center text-muted-foreground">
        Loading diagram...
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="bg-panel border border-border rounded-lg p-4 my-4 overflow-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// Render markdown with Mermaid support
function MarkdownWithMermaid({ content }: { content: string }) {
  const mermaidLoadedRef = useRef(false)

  // Extract mermaid blocks and convert rest to HTML
  const { html, mermaidBlocks } = parseMarkdownWithMermaid(content)

  useEffect(() => {
    // Load Mermaid from CDN if not already loaded
    // @ts-expect-error mermaid is loaded from CDN
    if (window.mermaid) {
      // @ts-expect-error mermaid is loaded from CDN
      window.mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        securityLevel: "loose",
      })
      return
    }

    if (!mermaidLoadedRef.current) {
      mermaidLoadedRef.current = true
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"
      script.async = true
      script.onload = () => {
        // @ts-expect-error mermaid is loaded from CDN
        window.mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
          securityLevel: "loose",
        })
      }
      script.onerror = (e) => {
        console.error("Failed to load Mermaid:", e)
      }
      document.head.appendChild(script)
    }
  }, [])

  // Split HTML by mermaid placeholders and render
  const parts = html.split(/(__MERMAID_(\d+)__)/)
  const elements: React.ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith("__MERMAID_") && part.endsWith("__")) {
      const index = parseInt(part.replace(/__MERMAID_(\d+)__/, "$1"))
      elements.push(
        <MermaidDiagram
          key={`mermaid-${index}`}
          chart={mermaidBlocks[index]}
          id={`mermaid-diagram-${index}`}
        />
      )
      i++ // Skip the captured group
    } else if (part && !part.match(/^\d+$/)) {
      elements.push(
        <div
          key={`html-${i}`}
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: part }}
        />
      )
    }
  }

  return <>{elements}</>
}

// Parse markdown and extract mermaid blocks
function parseMarkdownWithMermaid(md: string): { html: string; mermaidBlocks: string[] } {
  let html = md
  const mermaidBlocks: string[] = []

  // Extract mermaid blocks FIRST (before any escaping)
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code) => {
    const index = mermaidBlocks.length
    mermaidBlocks.push(code.trim())
    return `__MERMAID_${index}__`
  })

  // Convert the rest to HTML
  html = markdownToHtml(html)

  return { html, mermaidBlocks }
}

// Simple markdown to HTML converter (mermaid blocks already extracted)
function markdownToHtml(md: string): string {
  let html = md

  // Extract regular code blocks BEFORE escaping
  const codeBlocks: { lang: string; code: string }[] = []
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const index = codeBlocks.length
    codeBlocks.push({ lang: lang || "", code: code.trim() })
    return `__CODE_BLOCK_${index}__`
  })

  // Escape HTML
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Restore code blocks (escaped)
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => {
    const { lang, code } = codeBlocks[parseInt(index)]
    const escapedCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    return `<pre class="bg-panel border border-border rounded-lg p-4 overflow-x-auto my-4"><code class="text-sm text-text-primary language-${lang}">${escapedCode}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-panel px-1.5 py-0.5 rounded text-sm">$1</code>')

  // Headers with IDs
  html = html.replace(/^### (.+)$/gm, (_match, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return `<h3 id="${id}" class="text-lg font-bold mt-8 mb-4 text-text-primary scroll-mt-20">${text}</h3>`
  })
  html = html.replace(/^## (.+)$/gm, (_match, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return `<h2 id="${id}" class="text-xl font-bold mt-10 mb-4 text-text-primary border-b border-border pb-2 scroll-mt-20">${text}</h2>`
  })
  html = html.replace(/^# (.+)$/gm, (_match, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return `<h1 id="${id}" class="text-2xl font-bold mt-6 mb-6 text-text-primary scroll-mt-20">${text}</h1>`
  })

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split("|").filter(Boolean).map((c) => c.trim())
    const isHeader = cells.every((c) => /^-+$/.test(c))
    if (isHeader) return "" // Skip separator row

    const tag = "td"
    const cellsHtml = cells
      .map((c) => `<${tag} class="border border-border px-3 py-2">${c}</${tag}>`)
      .join("")
    return `<tr class="hover:bg-panel/50">${cellsHtml}</tr>`
  })
  html = html.replace(
    /(<tr[^>]*>[\s\S]*?<\/tr>\s*)+/g,
    '<table class="w-full border-collapse my-4">$&</table>'
  )

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>')

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary hover:underline">$1</a>'
  )

  // Blockquotes
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">$1</blockquote>'
  )

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>\s*)+/g, '<ul class="my-2 space-y-1">$&</ul>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-border my-8" />')

  // Paragraphs (wrap remaining text)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="my-2 text-text-secondary">$1</p>')

  return html
}

function CodebaseMapPage() {
  const { data, isLoading, error, refetch } = trpc.system.getCodebaseMap.useQuery()
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("h2[id], h3[id]")
      let current = ""

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect()
        if (rect.top < 150) {
          current = section.id
        }
      })

      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading codebase map...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load codebase map</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data?.exists || !data.content) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <Map className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Codebase Map Found</h2>
          <p className="text-muted-foreground mb-4">
            Run the Cartographer skill to generate a codebase map.
          </p>
          <p className="text-sm text-muted-foreground">
            Say "map this codebase" or "/cartographer" in Claude Code.
          </p>
        </div>
      </div>
    )
  }

  const { frontmatter, body } = parseFrontmatter(data.content)
  const toc = extractToc(body)

  return (
    <div className="flex h-full">
      {/* Table of Contents Sidebar */}
      <aside className="w-64 border-r border-border overflow-y-auto shrink-0 hidden lg:block">
        <div className="sticky top-0 bg-background p-4 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4" />
            <span>Contents</span>
          </div>
        </div>
        <nav className="p-4">
          <ul className="space-y-1 text-sm">
            {toc.map((item, i) => (
              <li
                key={i}
                style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
              >
                <a
                  href={`#${item.id}`}
                  className={`
                    flex items-center gap-1 py-1 px-2 rounded transition-colors
                    ${activeSection === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-text-primary hover:bg-panel"
                    }
                  `}
                >
                  {item.level > 1 && (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{item.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Codebase Map</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {frontmatter.last_mapped && (
                <span>
                  Last mapped: {new Date(frontmatter.last_mapped).toLocaleDateString()}
                </span>
              )}
              {frontmatter.total_files && (
                <span>{frontmatter.total_files} files</span>
              )}
              {frontmatter.total_tokens && (
                <span>{Number(frontmatter.total_tokens).toLocaleString()} tokens</span>
              )}
              <button
                onClick={() => refetch()}
                className="p-1 hover:bg-panel rounded"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <a
                href={data.path}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-panel rounded"
                title="Open file"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </header>

        {/* Markdown Content */}
        <article className="px-6 py-8 max-w-4xl">
          <MarkdownWithMermaid content={body} />
        </article>
      </main>
    </div>
  )
}
