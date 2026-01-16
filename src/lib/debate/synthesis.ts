/**
 * Spec Synthesis Module
 * Merges critique issues into a refined specification
 */

import { match } from 'ts-pattern'
import type { Critique, CritiqueIssue, DebateRound } from './types'

/**
 * Generate a synthesis prompt to create a refined spec from critiques
 */
export function generateSynthesisPrompt(
  originalSpec: string,
  critiques: Critique[]
): string {
  // Collect all non-trivial issues
  const allIssues = critiques.flatMap(c =>
    c.issues.map(issue => ({
      ...issue,
      persona: c.persona,
    }))
  )

  // Sort by severity
  const severityOrder = { critical: 0, major: 1, minor: 2, suggestion: 3 }
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Format issues for the prompt
  const issuesList = allIssues.map((issue, i) => {
    const parts = [
      `${i + 1}. [${issue.severity.toUpperCase()}] (${issue.persona}): ${issue.title}`,
      `   ${issue.description}`,
    ]
    if (issue.suggestion) {
      parts.push(`   Suggestion: ${issue.suggestion}`)
    }
    return parts.join('\n')
  }).join('\n\n')

  return `You are refining a technical specification based on multi-expert review feedback.

<original_specification>
${originalSpec}
</original_specification>

<review_feedback>
${issuesList}
</review_feedback>

Your task:
1. Address all CRITICAL and MAJOR issues in the specification
2. Consider MINOR issues and incorporate where appropriate
3. Note SUGGESTIONS for future consideration (don't necessarily implement)
4. Preserve the original structure and intent of the spec
5. Add any missing sections identified in the feedback

Return ONLY the refined specification in markdown format.
Do not include explanations or commentary - just the improved spec.
The spec should be complete and ready for implementation.`
}

/**
 * Generate a summary of changes between spec versions
 */
export function generateChangesSummary(
  critiques: Critique[]
): string {
  const addressedIssues: string[] = []
  const pendingIssues: string[] = []

  for (const critique of critiques) {
    for (const issue of critique.issues) {
      const issueStr = `[${critique.persona}/${issue.severity}] ${issue.title}`
      if (issue.severity === 'critical' || issue.severity === 'major') {
        addressedIssues.push(issueStr)
      } else {
        pendingIssues.push(issueStr)
      }
    }
  }

  const parts: string[] = []

  if (addressedIssues.length > 0) {
    parts.push(`Addressed:\n${addressedIssues.map(i => `- ${i}`).join('\n')}`)
  }

  if (pendingIssues.length > 0) {
    parts.push(`Deferred:\n${pendingIssues.map(i => `- ${i}`).join('\n')}`)
  }

  return parts.join('\n\n') || 'No significant changes'
}

/**
 * Check if consensus was reached based on critiques
 */
export function checkConsensus(
  critiques: Critique[],
  threshold: number
): boolean {
  if (critiques.length === 0) return false

  const approvals = critiques.filter(c => c.verdict === 'approve').length
  const ratio = approvals / critiques.length

  return ratio >= threshold
}

/**
 * Aggregate issues from all critiques, deduplicating similar ones
 */
export function aggregateIssues(critiques: Critique[]): {
  critical: CritiqueIssue[]
  major: CritiqueIssue[]
  minor: CritiqueIssue[]
  suggestions: CritiqueIssue[]
} {
  const result = {
    critical: [] as CritiqueIssue[],
    major: [] as CritiqueIssue[],
    minor: [] as CritiqueIssue[],
    suggestions: [] as CritiqueIssue[],
  }

  for (const critique of critiques) {
    for (const issue of critique.issues) {
      match(issue.severity)
        .with('critical', () => result.critical.push(issue))
        .with('major', () => result.major.push(issue))
        .with('minor', () => result.minor.push(issue))
        .with('suggestion', () => result.suggestions.push(issue))
        .exhaustive()
    }
  }

  return result
}

/**
 * Calculate overall round summary stats
 */
export function calculateRoundStats(round: DebateRound): {
  totalIssues: number
  criticalCount: number
  majorCount: number
  minorCount: number
  suggestionCount: number
  approvalRate: number
} {
  const issues = aggregateIssues(round.critiques)
  const approvals = round.critiques.filter(c => c.verdict === 'approve').length

  return {
    totalIssues: issues.critical.length + issues.major.length + issues.minor.length + issues.suggestions.length,
    criticalCount: issues.critical.length,
    majorCount: issues.major.length,
    minorCount: issues.minor.length,
    suggestionCount: issues.suggestions.length,
    approvalRate: round.critiques.length > 0 ? approvals / round.critiques.length : 0,
  }
}

/**
 * Parse a synthesis response (just extract the markdown spec)
 */
export function parseSynthesisResponse(response: string): string {
  // If wrapped in markdown code block, extract it
  const markdownMatch = response.match(/```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```/)
  if (markdownMatch) {
    return markdownMatch[1].trim()
  }

  // Otherwise return as-is, trimmed
  return response.trim()
}
