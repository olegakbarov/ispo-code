export type AutoRunPhase = 'planning' | 'execution' | null

export function parseAutoRunFromContent(content: string): boolean | undefined {
  const match = content.match(/<!--\s*autoRun:\s*(true|false)\s*-->/)
  return match ? match[1] === 'true' : undefined
}

export function inferAutoRunPhase(title?: string, _prompt?: string): AutoRunPhase {
  if (!title) return null

  const titleLower = title.toLowerCase().trim()

  if (titleLower.startsWith('plan:')) return 'planning'
  if (titleLower.startsWith('debug:') || /^debug \(\d+\):/.test(titleLower)) {
    return 'planning'
  }
  if (titleLower.startsWith('run:')) return 'execution'
  return null
}
