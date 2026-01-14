/**
 * Task Service - markdown-backed "tasks" entity
 *
 * Tasks are stored as markdown files in a few known locations inside the repo.
 * This service lists, reads, creates, and saves those files safely.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "fs"
import path from "path"
import { globSync } from "glob"

export type TaskSource = "kiro-spec" | "codemap-plan" | "tasks-dir"

export interface TaskProgress {
  total: number
  done: number
  inProgress: number
}

export interface TaskSummary {
  path: string
  title: string
  updatedAt: string
  source: TaskSource
  progress: TaskProgress
}

export interface TaskFile extends TaskSummary {
  content: string
}

const TASK_GLOBS: Array<{ pattern: string; source: TaskSource }> = [
  { pattern: ".kiro/specs/*/tasks.md", source: "kiro-spec" },
  { pattern: "tasks/**/*.md", source: "tasks-dir" },
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

  // General tasks directory
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

      tasks.push({
        path: relPath,
        title,
        updatedAt: new Date(stat.mtimeMs).toISOString(),
        source: sources.get(relPath) ?? sourceForPath(relPath),
        progress,
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

  return {
    path: relPath,
    title,
    updatedAt: new Date(stat.mtimeMs).toISOString(),
    source: sourceForPath(relPath),
    progress,
    content,
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

export function createTask(
  cwd: string,
  params: { title: string; content?: string }
): { path: string } {
  const title = params.title.trim()
  if (!title) throw new Error("Title is required")

  const baseDir = path.join(cwd, "tasks")
  mkdirSync(baseDir, { recursive: true })

  const slugBase = slugifyTitle(title)
  let candidate = `tasks/${slugBase}.md`
  let i = 2
  while (existsSync(path.join(cwd, candidate))) {
    candidate = `tasks/${slugBase}-${i}.md`
    i++
  }

  const initial =
    params.content ??
    `# ${title}\n\n## Plan\n\n- [ ] Define scope\n- [ ] Implement\n- [ ] Validate\n`

  saveTask(cwd, candidate, initial)
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
