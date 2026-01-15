/**
 * Task Service - markdown-backed "tasks" entity
 *
 * Tasks are stored as markdown files in a few known locations inside the repo.
 * This service lists, reads, creates, and saves those files safely.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync, renameSync, utimesSync } from "fs"
import path from "path"
import { globSync } from "glob"
import { nanoid } from "nanoid"

export type TaskSource = "kiro-spec" | "codemap-plan" | "tasks-dir"

export interface TaskProgress {
  total: number
  done: number
  inProgress: number
}

export interface TaskSummary {
  path: string
  title: string
  createdAt: string
  updatedAt: string
  source: TaskSource
  progress: TaskProgress
  archived: boolean
  archivedAt?: string
  subtaskCount: number // Number of subtasks (for UI indicator)
  hasSubtasks: boolean // Quick check if task has subtasks
}

export interface TaskFile extends TaskSummary {
  content: string
  splitFrom?: string
  subtasks: SubTask[]
  version: number // Optimistic locking version for concurrent modification detection
}

/**
 * Subtask stored inline within parent task markdown.
 * Max 20 subtasks per parent to prevent UI clutter.
 */
export interface SubTask {
  id: string // nanoid, stored as taskpath#subtaskid
  title: string
  checkboxes: CheckboxItem[]
  status: 'pending' | 'in_progress' | 'completed'
}

export interface CheckboxItem {
  text: string
  checked: boolean
}

export const MAX_SUBTASKS_PER_TASK = 20

/**
 * Represents a section in a task (phase/header with checkboxes)
 */
export interface TaskSection {
  title: string
  checkboxes: string[]
  startLine: number
  endLine: number
}

const TASK_GLOBS: Array<{ pattern: string; source: TaskSource }> = [
  { pattern: ".kiro/specs/*/tasks.md", source: "kiro-spec" },
  { pattern: "tasks/**/*.md", source: "tasks-dir" },
  { pattern: "tasks/archive/**/*.md", source: "tasks-dir" },
  { pattern: ".claude/plans/**/*.md", source: "codemap-plan" },
]

const TASK_SINGLE_FILES: Array<{ file: string; source: TaskSource }> = [
  { file: "PLAN.md", source: "codemap-plan" },
]

function normalizeRelPath(input: string): string {
  let p = input.trim().replace(/\\/g, "/")
  while (p.startsWith("./")) p = p.slice(2)
  return p
}

function isAllowedTaskPath(relPath: string): boolean {
  if (!relPath.endsWith(".md")) return false

  // Codemap plans
  if (relPath === "PLAN.md") return true
  if (relPath.startsWith(".claude/plans/") && relPath.endsWith(".md")) return true

  // Kiro specs and tasks
  if (relPath.startsWith(".kiro/specs/") && relPath.endsWith("/tasks.md")) return true
  if (relPath.startsWith(".kiro/tasks/") && relPath.endsWith(".md")) return true

  // General tasks directory (including archive)
  if (relPath.startsWith("tasks/") && relPath.endsWith(".md")) return true

  return false
}

function resolveTaskPath(cwd: string, relPathInput: string): { relPath: string; absPath: string } {
  const relPath = normalizeRelPath(relPathInput)

  if (!relPath) throw new Error("Task path is required")
  if (path.isAbsolute(relPath)) throw new Error("Task path must be relative")
  if (!isAllowedTaskPath(relPath)) throw new Error("Task path is not allowed")

  const parts = relPath.split("/").filter(Boolean)
  if (parts.some((p) => p === "..")) throw new Error("Invalid task path")

  const root = path.resolve(cwd)
  const absPath = path.resolve(root, relPath)
  if (absPath === root || !absPath.startsWith(root + path.sep)) {
    throw new Error("Invalid task path")
  }

  return { relPath, absPath }
}

function parseTitleFromMarkdown(content: string, fallback: string): string {
  const lines = content.split("\n")
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/)
    if (m?.[1]) return m[1]
  }
  return fallback
}

function parseProgressFromMarkdown(content: string): TaskProgress {
  // Support GFM-style checkboxes including: [ ], [x], [X], [-]
  const re = /^\s*-\s*\[([ xX-])\]/gm
  let total = 0
  let done = 0
  let inProgress = 0

  let match: RegExpExecArray | null
  while ((match = re.exec(content))) {
    total++
    const mark = match[1]
    if (mark === "x" || mark === "X") done++
    else if (mark === "-") inProgress++
  }

  return { total, done, inProgress }
}

/**
 * Extract splitFrom comment from markdown content
 * Looks for: <!-- splitFrom: tasks/original.md -->
 */
function parseSplitFrom(content: string): string | undefined {
  const match = content.match(/<!--\s*splitFrom:\s*(.+?)\s*-->/)
  return match?.[1]
}

/**
 * Extract version from markdown content for optimistic locking.
 * Looks for: <!-- version: N -->
 * Returns 1 if not found (default version for new/migrated tasks).
 */
function parseVersion(content: string): number {
  const match = content.match(/<!--\s*version:\s*(\d+)\s*-->/)
  return match ? parseInt(match[1], 10) : 1
}

/**
 * Parse subtasks from markdown content.
 * Subtasks are stored in a ## Subtasks section with format:
 *
 * ## Subtasks
 * ### [id] Title
 * Status: pending|in_progress|completed
 * - [ ] Checkbox item
 * - [x] Completed item
 */
export function parseSubtasks(content: string): SubTask[] {
  const lines = content.split("\n")
  const subtasks: SubTask[] = []

  let inSubtasksSection = false
  let currentSubtask: SubTask | null = null

  for (const line of lines) {
    // Detect ## Subtasks section start
    if (line.match(/^##\s+Subtasks\s*$/i)) {
      inSubtasksSection = true
      continue
    }

    // Detect exit from Subtasks section (another ## header)
    if (inSubtasksSection && line.match(/^##\s+/) && !line.match(/^##\s+Subtasks\s*$/i)) {
      // Save last subtask before exiting
      if (currentSubtask) {
        subtasks.push(currentSubtask)
        currentSubtask = null
      }
      inSubtasksSection = false
      continue
    }

    if (!inSubtasksSection) continue

    // Parse subtask header: ### [id] Title
    const subtaskHeaderMatch = line.match(/^###\s+\[([^\]]+)\]\s+(.+?)\s*$/)
    if (subtaskHeaderMatch) {
      // Save previous subtask
      if (currentSubtask) {
        subtasks.push(currentSubtask)
      }
      currentSubtask = {
        id: subtaskHeaderMatch[1],
        title: subtaskHeaderMatch[2],
        checkboxes: [],
        status: 'pending',
      }
      continue
    }

    // Parse status line: Status: pending|in_progress|completed
    if (currentSubtask) {
      const statusMatch = line.match(/^Status:\s*(pending|in_progress|completed)\s*$/i)
      if (statusMatch) {
        currentSubtask.status = statusMatch[1].toLowerCase() as SubTask['status']
        continue
      }

      // Parse checkbox: - [ ] text or - [x] text
      const checkboxMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.+?)\s*$/)
      if (checkboxMatch) {
        currentSubtask.checkboxes.push({
          text: checkboxMatch[2],
          checked: checkboxMatch[1].toLowerCase() === 'x',
        })
      }
    }
  }

  // Don't forget the last subtask
  if (currentSubtask) {
    subtasks.push(currentSubtask)
  }

  return subtasks
}

/**
 * Serialize subtasks to markdown format for embedding in task content.
 * Returns the ## Subtasks section content (without the header).
 */
export function serializeSubtasks(subtasks: SubTask[]): string {
  if (subtasks.length === 0) return ""

  const lines: string[] = ["## Subtasks", ""]

  for (const subtask of subtasks) {
    lines.push(`### [${subtask.id}] ${subtask.title}`)
    lines.push(`Status: ${subtask.status}`)

    for (const cb of subtask.checkboxes) {
      const mark = cb.checked ? "x" : " "
      lines.push(`- [${mark}] ${cb.text}`)
    }

    lines.push("") // Blank line between subtasks
  }

  return lines.join("\n")
}

/**
 * Remove the ## Subtasks section from markdown content.
 * Used when updating content to replace subtasks with new serialized version.
 */
export function removeSubtasksSection(content: string): string {
  const lines = content.split("\n")
  const result: string[] = []

  let inSubtasksSection = false

  for (const line of lines) {
    // Detect ## Subtasks section start
    if (line.match(/^##\s+Subtasks\s*$/i)) {
      inSubtasksSection = true
      continue
    }

    // Detect exit from Subtasks section (another ## header)
    if (inSubtasksSection && line.match(/^##\s+/) && !line.match(/^##\s+Subtasks\s*$/i)) {
      inSubtasksSection = false
    }

    if (!inSubtasksSection) {
      result.push(line)
    }
  }

  // Remove trailing empty lines
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop()
  }

  return result.join("\n")
}

/**
 * Update version comment in content, or add if not present.
 */
function updateVersionInContent(content: string, newVersion: number): string {
  const versionComment = `<!-- version: ${newVersion} -->`

  if (content.match(/<!--\s*version:\s*\d+\s*-->/)) {
    // Replace existing version
    return content.replace(/<!--\s*version:\s*\d+\s*-->/, versionComment)
  }

  // Add version after the title (first # line) or at the start
  const lines = content.split("\n")
  const titleIndex = lines.findIndex((line) => line.match(/^#\s+/))

  if (titleIndex >= 0) {
    // Insert after title
    lines.splice(titleIndex + 1, 0, "", versionComment)
    return lines.join("\n")
  }

  // Add at start
  return versionComment + "\n\n" + content
}

/**
 * Parse markdown into sections by phase/header
 * Sections are identified by `### Phase:` or `## ` headers
 * Returns sections with 3+ checkboxes each
 * Excludes ## Subtasks section (not splittable)
 */
export function parseSections(content: string): TaskSection[] {
  const lines = content.split("\n")
  const sections: TaskSection[] = []

  let currentSection: TaskSection | null = null
  let inSubtasksSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1 // 1-indexed

    // Detect ## Subtasks section (skip it entirely)
    if (line.match(/^##\s+Subtasks\s*$/i)) {
      // Save previous section before entering subtasks
      if (currentSection && currentSection.checkboxes.length >= 3) {
        currentSection.endLine = lineNum - 1
        sections.push(currentSection)
        currentSection = null
      }
      inSubtasksSection = true
      continue
    }

    // Check for section header: ### Phase: X or ## X (but not # which is title)
    const phaseMatch = line.match(/^###\s*Phase[:\s]+(.+?)\s*$/)
    const headerMatch = line.match(/^##\s+(.+?)\s*$/)

    if (phaseMatch || headerMatch) {
      // Exit subtasks section when we hit another ## header
      if (inSubtasksSection) {
        inSubtasksSection = false
      }

      // Save previous section if it has enough checkboxes
      if (currentSection && currentSection.checkboxes.length >= 3) {
        currentSection.endLine = lineNum - 1
        sections.push(currentSection)
      }

      // Start new section
      currentSection = {
        title: phaseMatch ? phaseMatch[1] : headerMatch![1],
        checkboxes: [],
        startLine: lineNum,
        endLine: lines.length, // Default to end, will be updated
      }
      continue
    }

    // Skip checkboxes inside Subtasks section
    if (inSubtasksSection) continue

    // Check for checkbox within current section
    if (currentSection) {
      const checkboxMatch = line.match(/^\s*-\s*\[([ xX-])\]\s*(.+?)\s*$/)
      if (checkboxMatch) {
        currentSection.checkboxes.push(checkboxMatch[2])
      }
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.checkboxes.length >= 3) {
    currentSection.endLine = lines.length
    sections.push(currentSection)
  }

  return sections
}

function sourceForPath(relPath: string): TaskSource {
  if (relPath.startsWith(".kiro/specs/") && relPath.endsWith("/tasks.md")) return "kiro-spec"
  if (relPath.startsWith("tasks/")) return "tasks-dir"
  if (relPath === "PLAN.md") return "codemap-plan"
  if (relPath.startsWith(".claude/plans/")) return "codemap-plan"
  return "tasks-dir"
}

export function listTasks(cwd: string): TaskSummary[] {
  const relPaths = new Set<string>()
  const sources = new Map<string, TaskSource>()

  for (const { pattern, source } of TASK_GLOBS) {
    const matches = globSync(pattern, { cwd, nodir: true, dot: true })
    for (const match of matches) {
      const relPath = normalizeRelPath(match)
      if (!isAllowedTaskPath(relPath)) continue
      relPaths.add(relPath)
      sources.set(relPath, source)
    }
  }

  for (const { file, source } of TASK_SINGLE_FILES) {
    const relPath = normalizeRelPath(file)
    const abs = path.join(cwd, relPath)
    if (!existsSync(abs)) continue
    if (!isAllowedTaskPath(relPath)) continue
    relPaths.add(relPath)
    sources.set(relPath, source)
  }

  const tasks: TaskSummary[] = []

  for (const relPath of relPaths) {
    try {
      const absPath = path.join(cwd, relPath)
      const stat = statSync(absPath)
      if (!stat.isFile()) continue

      const content = readFileSync(absPath, "utf-8")
      const fallbackTitle = path.basename(relPath, ".md")
      const title = parseTitleFromMarkdown(content, fallbackTitle)
      const progress = parseProgressFromMarkdown(content)

      // Determine if task is archived based on path
      const archived = relPath.startsWith("tasks/archive/")
      const archivedAt = archived ? new Date(stat.mtimeMs).toISOString() : undefined

      // Use birthtime if available, fall back to mtime
      const createdAtMs = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs

      // Parse subtasks (quick count for list view)
      const subtasks = parseSubtasks(content)

      tasks.push({
        path: relPath,
        title,
        createdAt: new Date(createdAtMs).toISOString(),
        updatedAt: new Date(stat.mtimeMs).toISOString(),
        source: sources.get(relPath) ?? sourceForPath(relPath),
        progress,
        archived,
        archivedAt,
        subtaskCount: subtasks.length,
        hasSubtasks: subtasks.length > 0,
      })
    } catch {
      // Skip unreadable tasks
    }
  }

  tasks.sort((a, b) => {
    const at = new Date(a.updatedAt).getTime()
    const bt = new Date(b.updatedAt).getTime()
    if (bt !== at) return bt - at
    return a.path.localeCompare(b.path)
  })

  return tasks
}

export function getTask(cwd: string, taskPath: string): TaskFile {
  const { relPath, absPath } = resolveTaskPath(cwd, taskPath)

  if (!existsSync(absPath)) {
    throw new Error(`Task not found: ${relPath}`)
  }

  const content = readFileSync(absPath, "utf-8")
  const stat = statSync(absPath)
  const fallbackTitle = path.basename(relPath, ".md")
  const title = parseTitleFromMarkdown(content, fallbackTitle)
  const progress = parseProgressFromMarkdown(content)
  const splitFrom = parseSplitFrom(content)
  const version = parseVersion(content)
  const subtasks = parseSubtasks(content)

  // Determine if task is archived based on path
  const archived = relPath.startsWith("tasks/archive/")
  const archivedAt = archived ? new Date(stat.mtimeMs).toISOString() : undefined

  // Use birthtime if available, fall back to mtime
  const createdAtMs = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs

  return {
    path: relPath,
    title,
    createdAt: new Date(createdAtMs).toISOString(),
    updatedAt: new Date(stat.mtimeMs).toISOString(),
    source: sourceForPath(relPath),
    progress,
    archived,
    archivedAt,
    subtaskCount: subtasks.length,
    hasSubtasks: subtasks.length > 0,
    content,
    splitFrom,
    subtasks,
    version,
  }
}

export function saveTask(cwd: string, taskPath: string, content: string): TaskFile {
  const { relPath, absPath } = resolveTaskPath(cwd, taskPath)

  mkdirSync(path.dirname(absPath), { recursive: true })
  writeFileSync(absPath, content, "utf-8")

  return getTask(cwd, relPath)
}

function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "task"
}

/**
 * Generate a short slug from a task title for use as filename prefix.
 * Extracts first 3 meaningful words (skipping common stop words).
 * Example: "implement auth system with oauth" -> "implement-auth-system"
 */
export function generateShortSlug(title: string, maxWords = 3): string {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "under",
    "again", "further", "then", "once", "here", "there", "when", "where",
    "why", "how", "all", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "just", "and", "but", "if", "or", "because", "until", "while",
    "this", "that", "these", "those", "it", "we", "you", "they",
  ])

  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .slice(0, maxWords)

  const slug = words.join("-")
  return slug || "task"
}

export function createTask(
  cwd: string,
  params: { title: string; content?: string; prefix?: string; mtime?: Date }
): { path: string } {
  const title = params.title.trim()
  if (!title) throw new Error("Title is required")

  const baseDir = path.join(cwd, "tasks")
  mkdirSync(baseDir, { recursive: true })

  const slugBase = slugifyTitle(title)
  // If prefix provided, prepend it to the filename
  const fullSlug = params.prefix ? `${params.prefix}-${slugBase}` : slugBase
  let candidate = `tasks/${fullSlug}.md`
  let i = 2
  while (existsSync(path.join(cwd, candidate))) {
    candidate = `tasks/${fullSlug}-${i}.md`
    i++
  }

  const initial =
    params.content ??
    `# ${title}\n\n## Plan\n\n- [ ] Define scope\n- [ ] Implement\n- [ ] Validate\n`

  saveTask(cwd, candidate, initial)

  // Set custom mtime if provided (for split task ordering)
  if (params.mtime) {
    const absPath = path.resolve(cwd, candidate)
    utimesSync(absPath, params.mtime, params.mtime)
  }

  return { path: candidate }
}

export function deleteTask(cwd: string, taskPath: string): { success: boolean } {
  const { absPath } = resolveTaskPath(cwd, taskPath)

  if (!existsSync(absPath)) {
    throw new Error(`Task not found: ${taskPath}`)
  }

  unlinkSync(absPath)

  return { success: true }
}

/**
 * Archive a task by moving it to tasks/archive/YYYY-MM/
 */
export function archiveTask(cwd: string, taskPath: string): { path: string } {
  const { relPath, absPath } = resolveTaskPath(cwd, taskPath)

  if (!existsSync(absPath)) {
    throw new Error(`Task not found: ${relPath}`)
  }

  // Don't archive already archived tasks
  if (relPath.startsWith("tasks/archive/")) {
    throw new Error("Task is already archived")
  }

  // Only archive tasks from tasks/ directory
  if (!relPath.startsWith("tasks/")) {
    throw new Error("Can only archive tasks from tasks/ directory")
  }

  // Generate archive path: tasks/archive/YYYY-MM/filename.md
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const filename = path.basename(relPath)
  const archiveDir = path.join(cwd, "tasks", "archive", yearMonth)

  // Create archive directory
  mkdirSync(archiveDir, { recursive: true })

  // Handle name conflicts by appending -2, -3, etc.
  let archivePath = `tasks/archive/${yearMonth}/${filename}`
  let archiveAbsPath = path.join(cwd, archivePath)
  let i = 2
  while (existsSync(archiveAbsPath)) {
    const baseName = path.basename(filename, ".md")
    archivePath = `tasks/archive/${yearMonth}/${baseName}-${i}.md`
    archiveAbsPath = path.join(cwd, archivePath)
    i++
  }

  // Move the file
  renameSync(absPath, archiveAbsPath)

  return { path: archivePath }
}

/**
 * Restore an archived task by moving it back to tasks/
 */
export function restoreTask(cwd: string, archivePath: string): { path: string } {
  const { relPath, absPath } = resolveTaskPath(cwd, archivePath)

  if (!existsSync(absPath)) {
    throw new Error(`Task not found: ${relPath}`)
  }

  // Only restore archived tasks
  if (!relPath.startsWith("tasks/archive/")) {
    throw new Error("Can only restore archived tasks")
  }

  // Generate restored path: tasks/filename.md
  const filename = path.basename(relPath)
  let restoredPath = `tasks/${filename}`
  let restoredAbsPath = path.join(cwd, restoredPath)

  // Handle name conflicts by appending -2, -3, etc.
  let i = 2
  while (existsSync(restoredAbsPath)) {
    const baseName = path.basename(filename, ".md")
    restoredPath = `tasks/${baseName}-${i}.md`
    restoredAbsPath = path.join(cwd, restoredPath)
    i++
  }

  // Move the file
  renameSync(absPath, restoredAbsPath)

  return { path: restoredPath }
}

/**
 * Result of searching archived tasks
 */
export interface ArchivedTaskMatch {
  path: string
  title: string
  snippet: string
  context: BugContext | null
}

/**
 * Extracted context from a bug task
 */
export interface BugContext {
  rootCause: string | null
  solution: string | null
  keyFiles: string[]
}

/**
 * Extract keywords from a bug title for searching
 */
function extractKeywords(title: string): string[] {
  // Remove common stop words and split into words
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
    "because", "until", "while", "this", "that", "these", "those", "it",
    "bug", "fix", "issue", "problem", "error", "doesn't", "don't", "didn't",
    "won't", "can't", "cannot", "work", "working", "broken",
  ])

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
}

/**
 * Search archived tasks for bugs similar to the given query.
 * Uses simple keyword matching on title and content.
 * Returns top matches with extracted context.
 */
export function searchArchivedTasks(
  cwd: string,
  query: string,
  maxResults = 5
): ArchivedTaskMatch[] {
  const keywords = extractKeywords(query)
  if (keywords.length === 0) return []

  // Glob for archived tasks
  const archivePattern = "tasks/archive/**/*.md"
  const archivePaths = globSync(archivePattern, { cwd, nodir: true, dot: true })

  const matches: Array<{
    path: string
    title: string
    content: string
    score: number
  }> = []

  for (const relPath of archivePaths) {
    try {
      const absPath = path.join(cwd, relPath)
      const content = readFileSync(absPath, "utf-8")
      const title = parseTitleFromMarkdown(content, path.basename(relPath, ".md"))

      // Score based on keyword matches in title (weighted 3x) and content
      const titleLower = title.toLowerCase()
      const contentLower = content.toLowerCase()

      let score = 0
      for (const keyword of keywords) {
        // Title matches worth more
        if (titleLower.includes(keyword)) {
          score += 3
        }
        // Content matches
        const contentMatches = (contentLower.match(new RegExp(keyword, "g")) || []).length
        score += Math.min(contentMatches, 3) // Cap at 3 per keyword to avoid spam
      }

      if (score > 0) {
        matches.push({ path: relPath, title, content, score })
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by score descending, take top results
  matches.sort((a, b) => b.score - a.score)
  const topMatches = matches.slice(0, maxResults)

  // Extract context and snippets from top matches
  return topMatches.map((match) => {
    const context = extractBugContext(match.content)
    const snippet = extractSnippet(match.content, keywords)

    return {
      path: match.path,
      title: match.title,
      snippet,
      context,
    }
  })
}

/**
 * Extract a relevant snippet from content based on keywords
 */
function extractSnippet(content: string, keywords: string[]): string {
  const lines = content.split("\n")

  // Find lines containing keywords
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase()
    if (keywords.some((kw) => line.includes(kw))) {
      // Return this line and next 2, trimmed
      const snippetLines = lines.slice(i, i + 3)
      const snippet = snippetLines.join(" ").trim()
      if (snippet.length > 200) {
        return snippet.substring(0, 197) + "..."
      }
      return snippet
    }
  }

  // Fallback: first non-empty content line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.length > 200 ? trimmed.substring(0, 197) + "..." : trimmed
    }
  }

  return ""
}

/**
 * Extract bug context from task content.
 * Looks for root cause, solution, and key files sections.
 */
export function extractBugContext(content: string): BugContext | null {
  const lines = content.split("\n")

  let rootCause: string | null = null
  let solution: string | null = null
  const keyFiles: string[] = []

  let currentSection: "root-cause" | "solution" | "files" | null = null
  let sectionContent: string[] = []

  const saveSection = () => {
    if (currentSection && sectionContent.length > 0) {
      const text = sectionContent.join(" ").trim()
      if (currentSection === "root-cause" && !rootCause) {
        rootCause = text.length > 300 ? text.substring(0, 297) + "..." : text
      } else if (currentSection === "solution" && !solution) {
        solution = text.length > 300 ? text.substring(0, 297) + "..." : text
      }
    }
    sectionContent = []
  }

  for (const line of lines) {
    const lineLower = line.toLowerCase().trim()

    // Detect section headers
    if (lineLower.match(/^#+\s*(root\s*cause|cause)/)) {
      saveSection()
      currentSection = "root-cause"
      continue
    }
    if (lineLower.match(/^#+\s*(solution|fix|resolution|changes?\s*made)/)) {
      saveSection()
      currentSection = "solution"
      continue
    }
    if (lineLower.match(/^#+\s*(files?\s*(modified|changed)|key\s*files)/)) {
      saveSection()
      currentSection = "files"
      continue
    }
    // New section resets current
    if (lineLower.match(/^#+\s/)) {
      saveSection()
      currentSection = null
      continue
    }

    // Collect content for current section
    if (currentSection === "root-cause" || currentSection === "solution") {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("```")) {
        // Skip code blocks and empty lines
        sectionContent.push(trimmed)
      }
    }

    // Extract file paths from files section or inline references
    if (currentSection === "files" || line.includes(".ts") || line.includes(".tsx")) {
      const fileMatches = line.match(/`([^`]+\.(ts|tsx|js|jsx|md))`/g)
      if (fileMatches) {
        for (const match of fileMatches) {
          const filePath = match.replace(/`/g, "")
          if (!keyFiles.includes(filePath) && keyFiles.length < 5) {
            keyFiles.push(filePath)
          }
        }
      }
    }
  }

  // Save last section
  saveSection()

  // Return null if no useful context found
  if (!rootCause && !solution && keyFiles.length === 0) {
    return null
  }

  return { rootCause, solution, keyFiles }
}

/**
 * Add subtasks to a parent task.
 * Appends subtasks to the ## Subtasks section, creating it if needed.
 * Enforces MAX_SUBTASKS_PER_TASK limit.
 *
 * @param cwd - Working directory
 * @param taskPath - Path to parent task
 * @param newSubtasks - Array of subtasks to add (without IDs - will be generated)
 * @param expectedVersion - Optional version for optimistic locking (throws if mismatch)
 * @returns Updated task with new subtasks
 */
export function addSubtasksToTask(
  cwd: string,
  taskPath: string,
  newSubtasks: Omit<SubTask, 'id'>[],
  expectedVersion?: number
): TaskFile {
  const task = getTask(cwd, taskPath)

  // Check optimistic lock version
  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    throw new Error(
      `Task was modified by another process (version ${task.version} != expected ${expectedVersion}). ` +
      `Please reload and retry.`
    )
  }

  // Check subtask limit
  const totalSubtasks = task.subtasks.length + newSubtasks.length
  if (totalSubtasks > MAX_SUBTASKS_PER_TASK) {
    throw new Error(
      `Cannot add ${newSubtasks.length} subtasks: would exceed limit of ${MAX_SUBTASKS_PER_TASK}. ` +
      `Current: ${task.subtasks.length}`
    )
  }

  // Generate IDs for new subtasks
  const subtasksWithIds: SubTask[] = newSubtasks.map((st) => ({
    ...st,
    id: nanoid(8), // 8-char ID for brevity
  }))

  // Combine existing and new subtasks
  const allSubtasks = [...task.subtasks, ...subtasksWithIds]

  // Remove existing subtasks section and append new one
  let newContent = removeSubtasksSection(task.content)

  // Update version
  const newVersion = task.version + 1
  newContent = updateVersionInContent(newContent, newVersion)

  // Append subtasks section if there are any
  if (allSubtasks.length > 0) {
    newContent = newContent.trimEnd() + "\n\n" + serializeSubtasks(allSubtasks)
  }

  return saveTask(cwd, taskPath, newContent)
}

/**
 * Update a specific subtask within a parent task.
 *
 * @param cwd - Working directory
 * @param taskPath - Path to parent task
 * @param subtaskId - ID of subtask to update
 * @param updates - Partial updates to apply
 * @param expectedVersion - Optional version for optimistic locking
 * @returns Updated task
 */
export function updateSubtask(
  cwd: string,
  taskPath: string,
  subtaskId: string,
  updates: Partial<Omit<SubTask, 'id'>>,
  expectedVersion?: number
): TaskFile {
  const task = getTask(cwd, taskPath)

  // Check optimistic lock version
  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    throw new Error(
      `Task was modified by another process (version ${task.version} != expected ${expectedVersion}). ` +
      `Please reload and retry.`
    )
  }

  // Find and update the subtask
  const subtaskIndex = task.subtasks.findIndex((st) => st.id === subtaskId)
  if (subtaskIndex === -1) {
    throw new Error(`Subtask not found: ${subtaskId}`)
  }

  const updatedSubtasks = [...task.subtasks]
  updatedSubtasks[subtaskIndex] = {
    ...updatedSubtasks[subtaskIndex],
    ...updates,
  }

  // Remove existing subtasks section and append new one
  let newContent = removeSubtasksSection(task.content)

  // Update version
  const newVersion = task.version + 1
  newContent = updateVersionInContent(newContent, newVersion)

  // Append subtasks section
  if (updatedSubtasks.length > 0) {
    newContent = newContent.trimEnd() + "\n\n" + serializeSubtasks(updatedSubtasks)
  }

  return saveTask(cwd, taskPath, newContent)
}

/**
 * Delete a subtask from a parent task.
 *
 * @param cwd - Working directory
 * @param taskPath - Path to parent task
 * @param subtaskId - ID of subtask to delete
 * @param expectedVersion - Optional version for optimistic locking
 * @returns Updated task
 */
export function deleteSubtask(
  cwd: string,
  taskPath: string,
  subtaskId: string,
  expectedVersion?: number
): TaskFile {
  const task = getTask(cwd, taskPath)

  // Check optimistic lock version
  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    throw new Error(
      `Task was modified by another process (version ${task.version} != expected ${expectedVersion}). ` +
      `Please reload and retry.`
    )
  }

  // Find and remove the subtask
  const subtaskIndex = task.subtasks.findIndex((st) => st.id === subtaskId)
  if (subtaskIndex === -1) {
    throw new Error(`Subtask not found: ${subtaskId}`)
  }

  const updatedSubtasks = task.subtasks.filter((st) => st.id !== subtaskId)

  // Remove existing subtasks section and append new one
  let newContent = removeSubtasksSection(task.content)

  // Update version
  const newVersion = task.version + 1
  newContent = updateVersionInContent(newContent, newVersion)

  // Append subtasks section if any remain
  if (updatedSubtasks.length > 0) {
    newContent = newContent.trimEnd() + "\n\n" + serializeSubtasks(updatedSubtasks)
  }

  return saveTask(cwd, taskPath, newContent)
}

/**
 * Get a specific subtask from a parent task.
 *
 * @param cwd - Working directory
 * @param taskPath - Path to parent task
 * @param subtaskId - ID of subtask to get
 * @returns The subtask
 */
export function getSubtask(
  cwd: string,
  taskPath: string,
  subtaskId: string
): SubTask {
  const task = getTask(cwd, taskPath)

  const subtask = task.subtasks.find((st) => st.id === subtaskId)
  if (!subtask) {
    throw new Error(`Subtask not found: ${subtaskId}`)
  }

  return subtask
}

/**
 * Migration result for splitFrom tasks
 */
export interface MigrationResult {
  migratedCount: number
  skippedCount: number
  errors: Array<{ path: string; error: string }>
}

/**
 * Find all tasks with splitFrom comments that can be migrated.
 * Returns tasks grouped by their splitFrom source.
 */
export function findSplitFromTasks(cwd: string): Map<string, TaskFile[]> {
  const tasks = listTasks(cwd)
  const splitFromGroups = new Map<string, TaskFile[]>()

  for (const summary of tasks) {
    try {
      const task = getTask(cwd, summary.path)
      if (task.splitFrom) {
        const existing = splitFromGroups.get(task.splitFrom) || []
        existing.push(task)
        splitFromGroups.set(task.splitFrom, existing)
      }
    } catch {
      // Skip unreadable tasks
    }
  }

  return splitFromGroups
}

/**
 * Migrate a single splitFrom task to be a subtask of its parent.
 * This converts the child task's content into a subtask and removes the child file.
 *
 * @param cwd - Working directory
 * @param childPath - Path to the child task (with splitFrom)
 * @param parentPath - Path to the parent task
 * @returns true if migration succeeded
 */
export function migrateSplitFromTask(
  cwd: string,
  childPath: string,
  parentPath: string
): boolean {
  // Get child task
  const childTask = getTask(cwd, childPath)

  // Get parent task
  let parentTask: TaskFile
  try {
    parentTask = getTask(cwd, parentPath)
  } catch {
    // Parent doesn't exist, can't migrate
    return false
  }

  // Check parent subtask limit
  if (parentTask.subtasks.length >= MAX_SUBTASKS_PER_TASK) {
    return false
  }

  // Extract checkboxes from child content
  const checkboxes: CheckboxItem[] = []
  const checkboxRe = /^\s*-\s*\[([ xX])\]\s*(.+?)\s*$/gm
  let match
  while ((match = checkboxRe.exec(childTask.content)) !== null) {
    checkboxes.push({
      text: match[2],
      checked: match[1].toLowerCase() === 'x',
    })
  }

  // Determine status based on checkboxes
  let status: SubTask['status'] = 'pending'
  if (checkboxes.length > 0) {
    const completedCount = checkboxes.filter((cb) => cb.checked).length
    if (completedCount === checkboxes.length) {
      status = 'completed'
    } else if (completedCount > 0) {
      status = 'in_progress'
    }
  }

  // Add as subtask to parent
  addSubtasksToTask(cwd, parentPath, [{
    title: childTask.title,
    checkboxes,
    status,
  }])

  // Archive the child task (move to archive instead of delete for safety)
  try {
    archiveTask(cwd, childPath)
  } catch {
    // If archive fails (maybe already archived), try to delete
    try {
      deleteTask(cwd, childPath)
    } catch {
      // Ignore delete errors
    }
  }

  return true
}

/**
 * Migrate all splitFrom tasks to subtasks.
 * Groups tasks by their splitFrom source and migrates each group.
 *
 * @param cwd - Working directory
 * @returns Migration result with counts and errors
 */
export function migrateAllSplitFromTasks(cwd: string): MigrationResult {
  const splitFromGroups = findSplitFromTasks(cwd)
  const result: MigrationResult = {
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  }

  for (const [parentPath, childTasks] of splitFromGroups) {
    for (const childTask of childTasks) {
      try {
        const success = migrateSplitFromTask(cwd, childTask.path, parentPath)
        if (success) {
          result.migratedCount++
        } else {
          result.skippedCount++
        }
      } catch (error) {
        result.errors.push({
          path: childTask.path,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  return result
}
