/**
 * Debate Storage Module
 * File-backed persistence for debate sessions at .agentz/debates/{taskSlug}.json
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DebateSession } from './types'

/**
 * Convert task path to a filesystem-safe slug
 * e.g. "tasks/my-feature.md" -> "tasks~my-feature"
 */
function taskPathToSlug(taskPath: string): string {
  return taskPath
    .replace(/\.md$/, '')
    .replace(/\//g, '~')
}

/**
 * Get the debates directory path
 */
function getDebatesDir(workingDir: string): string {
  return path.join(workingDir, '.agentz', 'debates')
}

/**
 * Get the file path for a debate session
 */
function getDebateFilePath(workingDir: string, taskPath: string): string {
  const slug = taskPathToSlug(taskPath)
  return path.join(getDebatesDir(workingDir), `${slug}.json`)
}

/**
 * Ensure the debates directory exists
 */
function ensureDebatesDir(workingDir: string): void {
  const dir = getDebatesDir(workingDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Save a debate session to disk
 */
export function saveDebate(workingDir: string, session: DebateSession): void {
  ensureDebatesDir(workingDir)
  const filePath = getDebateFilePath(workingDir, session.taskPath)
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
}

/**
 * Load a debate session from disk for a specific task
 * Returns null if no debate exists
 */
export function loadDebate(workingDir: string, taskPath: string): DebateSession | null {
  const filePath = getDebateFilePath(workingDir, taskPath)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as DebateSession
  } catch (err) {
    console.error(`[loadDebate] Failed to load debate for ${taskPath}:`, err)
    return null
  }
}

/**
 * Delete a debate session from disk
 */
export function deleteDebate(workingDir: string, taskPath: string): boolean {
  const filePath = getDebateFilePath(workingDir, taskPath)

  if (!fs.existsSync(filePath)) {
    return false
  }

  try {
    fs.unlinkSync(filePath)
    return true
  } catch (err) {
    console.error(`[deleteDebate] Failed to delete debate for ${taskPath}:`, err)
    return false
  }
}

/**
 * Check if a debate exists for a task
 */
export function debateExists(workingDir: string, taskPath: string): boolean {
  const filePath = getDebateFilePath(workingDir, taskPath)
  return fs.existsSync(filePath)
}

/**
 * List all active debates (status not 'completed')
 */
export function listActiveDebates(workingDir: string): DebateSession[] {
  const dir = getDebatesDir(workingDir)

  if (!fs.existsSync(dir)) {
    return []
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  const debates: DebateSession[] = []

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8')
      const session = JSON.parse(content) as DebateSession

      // Only include non-completed debates
      if (session.status !== 'completed') {
        debates.push(session)
      }
    } catch {
      // Skip invalid files
    }
  }

  return debates
}
