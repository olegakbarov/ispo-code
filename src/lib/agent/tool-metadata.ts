/**
 * Tool metadata for UI rendering
 */

import {
  FileText,
  FilePen,
  FileEdit,
  FolderOpen,
  FolderSearch,
  Search,
  Terminal,
  CircleHelp,
  type LucideIcon,
} from "lucide-react"

export type ToolCategory = "file-ops" | "search" | "execution" | "interaction" | "other"

export interface ToolMetadata {
  name: string
  category: ToolCategory
  icon: LucideIcon
  description: string
  color: string
}

/**
 * Tool category definitions
 */
export const TOOL_CATEGORIES: Record<ToolCategory, { color: string; label: string }> = {
  "file-ops": {
    color: "var(--tool-file-ops)",
    label: "File",
  },
  search: {
    color: "var(--tool-search)",
    label: "Search",
  },
  execution: {
    color: "var(--tool-execution)",
    label: "Execute",
  },
  interaction: {
    color: "var(--tool-interaction)",
    label: "Question",
  },
  other: {
    color: "var(--tool-other)",
    label: "Other",
  },
}

/**
 * Tool metadata registry
 */
export const TOOL_REGISTRY: Record<string, ToolMetadata> = {
  read: {
    name: "read",
    category: "file-ops",
    icon: FileText,
    description: "Read file with line numbers",
    color: TOOL_CATEGORIES["file-ops"].color,
  },
  write: {
    name: "write",
    category: "file-ops",
    icon: FilePen,
    description: "Write content to file",
    color: TOOL_CATEGORIES["file-ops"].color,
  },
  edit: {
    name: "edit",
    category: "file-ops",
    icon: FileEdit,
    description: "Edit file by replacing text",
    color: TOOL_CATEGORIES["file-ops"].color,
  },
  ls: {
    name: "ls",
    category: "file-ops",
    icon: FolderOpen,
    description: "List directory contents",
    color: TOOL_CATEGORIES["file-ops"].color,
  },
  glob: {
    name: "glob",
    category: "search",
    icon: FolderSearch,
    description: "Find files by glob pattern",
    color: TOOL_CATEGORIES.search.color,
  },
  grep: {
    name: "grep",
    category: "search",
    icon: Search,
    description: "Search files for regex pattern",
    color: TOOL_CATEGORIES.search.color,
  },
  bash: {
    name: "bash",
    category: "execution",
    icon: Terminal,
    description: "Run shell command",
    color: TOOL_CATEGORIES.execution.color,
  },
  AskUserQuestion: {
    name: "AskUserQuestion",
    category: "interaction",
    icon: CircleHelp,
    description: "Ask user a question with options",
    color: TOOL_CATEGORIES.interaction.color,
  },
}

/**
 * Get tool metadata by name, with fallback for unknown tools
 */
export function getToolMetadata(toolName: string): ToolMetadata {
  return (
    TOOL_REGISTRY[toolName] ?? {
      name: toolName,
      category: "other",
      icon: Terminal,
      description: "Unknown tool",
      color: TOOL_CATEGORIES.other.color,
    }
  )
}
