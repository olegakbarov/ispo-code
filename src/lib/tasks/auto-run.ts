export type AutoRunPhase = 'planning' | 'execution' | null

export function parseAutoRunFromContent(content: string): boolean | undefined {
  const match = content.match(/<!--\s*autoRun:\s*(true|false)\s*-->/)
  return match ? match[1] === 'true' : undefined
}

export function inferAutoRunPhase(title?: string, prompt?: string): AutoRunPhase {
  const signature = [title, prompt].filter(Boolean).join(' ').toLowerCase()

  if (!signature) return null

  if (signature.includes('plan:') || signature.includes('debug:')) return 'planning'
  if (
    signature.includes('run:') ||
    signature.includes('implement') ||
    signature.includes('execution')
  ) {
    return 'execution'
  }
  return null
}
