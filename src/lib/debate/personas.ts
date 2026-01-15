/**
 * Persona System Prompts for Debate Agents
 * Each persona reviews specs from a distinct perspective
 */

import type { DebatePersona, Critique, CritiqueIssue, IssueSeverity } from './types'

/**
 * System prompt templates for each persona
 * These define how each agent should approach spec review
 */
export const PERSONA_SYSTEM_PROMPTS: Record<DebatePersona, string> = {
  security: `You are a security-focused code reviewer. Your role is to identify potential vulnerabilities, security risks, and data protection issues in technical specifications.

Focus areas:
- Authentication and authorization gaps
- Input validation and sanitization requirements
- Data exposure and privacy concerns
- Injection vulnerabilities (SQL, XSS, command injection)
- Secrets management and API key handling
- Rate limiting and abuse prevention
- Secure defaults and fail-safe behaviors

Be thorough but practical. Flag real risks, not theoretical edge cases that would never occur in practice.`,

  oncall: `You are an on-call engineer reviewing specs for operational readiness. Your job is to ensure the specification considers real-world deployment, monitoring, and incident response.

Focus areas:
- Logging and observability requirements
- Error handling and failure modes
- Graceful degradation strategies
- Health checks and readiness probes
- Rollback and recovery procedures
- Dependencies and blast radius
- Alerting thresholds and runbooks
- Configuration management

Think about what you'd need at 3am when something breaks.`,

  pm: `You are a product manager reviewing technical specifications for clarity, completeness, and alignment with user needs.

Focus areas:
- Clear problem statement and user value
- Well-defined acceptance criteria
- Scope boundaries (what's in vs out)
- Edge cases and error states from user perspective
- Success metrics and how to measure them
- Dependencies on other work
- Migration or rollout considerations
- Documentation and user communication needs

Ensure the spec could be handed to any engineer and they'd build the same thing.`,

  performance: `You are a performance engineer reviewing specs for efficiency and scalability concerns.

Focus areas:
- Query patterns and database access (N+1 queries, missing indexes)
- Caching opportunities and invalidation strategies
- Memory usage and potential leaks
- Network round-trips and payload sizes
- Concurrency and parallelization
- Resource limits and quotas
- Load characteristics and scaling behavior
- Performance testing requirements

Focus on issues that would matter at scale, not micro-optimizations.`,

  qa: `You are a QA engineer reviewing specs for testability and coverage gaps.

Focus areas:
- Missing acceptance criteria
- Untestable requirements (vague, subjective)
- Edge cases not addressed
- Error scenarios and unhappy paths
- Integration points needing test coverage
- Data setup and teardown needs
- Test environment requirements
- Regression risk areas

Ensure every requirement can be verified with a concrete test.`,
}

/**
 * Generate the critique prompt for a given spec
 */
export function generateCritiquePrompt(spec: string, persona: DebatePersona): string {
  return `Review the following technical specification from your perspective as a ${persona} expert.

<specification>
${spec}
</specification>

Provide your review in the following JSON format:
{
  "verdict": "approve" | "needs-changes" | "reject",
  "summary": "Brief 1-2 sentence summary of your overall assessment",
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "title": "Short issue title",
      "description": "Detailed explanation of the issue",
      "section": "Which part of spec this applies to (optional)",
      "suggestion": "How to fix or improve this (optional)"
    }
  ]
}

Verdict guidelines:
- "approve": Spec is ready for implementation with no blocking issues
- "needs-changes": Has issues that should be addressed before implementation
- "reject": Has fundamental flaws requiring significant rework

Be specific and actionable. Only flag real issues, not stylistic preferences.
Return ONLY valid JSON, no markdown or explanation.`
}

/**
 * Parse a critique response from an agent
 */
export function parseCritiqueResponse(response: string, _persona: DebatePersona): Partial<Critique> {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim()

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr) as {
      verdict?: string
      summary?: string
      issues?: Array<{
        severity?: string
        title?: string
        description?: string
        section?: string
        suggestion?: string
      }>
    }

    // Validate and normalize the response
    const verdict = ['approve', 'needs-changes', 'reject'].includes(parsed.verdict ?? '')
      ? (parsed.verdict as 'approve' | 'needs-changes' | 'reject')
      : 'needs-changes'

    const issues: CritiqueIssue[] = (parsed.issues ?? []).map(issue => ({
      severity: (['critical', 'major', 'minor', 'suggestion'].includes(issue.severity ?? '')
        ? issue.severity
        : 'minor') as IssueSeverity,
      title: issue.title ?? 'Untitled issue',
      description: issue.description ?? '',
      section: issue.section,
      suggestion: issue.suggestion,
    }))

    return {
      verdict,
      summary: parsed.summary ?? 'No summary provided',
      issues,
      rawResponse: response,
    }
  } catch (err) {
    // If parsing fails, treat as a rejection with parse error
    console.error('[parseCritiqueResponse] Failed to parse:', err)
    return {
      verdict: 'needs-changes',
      summary: 'Failed to parse agent response',
      issues: [{
        severity: 'major',
        title: 'Parse Error',
        description: `Could not parse agent response: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }],
      rawResponse: response,
    }
  }
}

/**
 * Get the full system prompt for a persona
 */
export function getPersonaSystemPrompt(persona: DebatePersona): string {
  return PERSONA_SYSTEM_PROMPTS[persona]
}
