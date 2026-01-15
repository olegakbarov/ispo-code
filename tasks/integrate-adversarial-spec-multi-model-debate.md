# Integrate Adversarial Spec: Multi-Model Debate

## Problem

Single-model task planning misses edge cases, accepts flawed premises, lacks critical examination. LLMs are inherently "agreeable" - they don't challenge assumptions effectively when working alone.

## Solution

Integrate multi-model debate pattern from [adversarial-spec](https://github.com/zscole/adversarial-spec) to refine tasks/specs before agent execution. Multiple agents critique from different perspectives until consensus.

```
User writes task → Agents debate in rounds → Synthesize feedback → Repeat until consensus → Execute refined task
```

## Core Concepts

### Debate Round
```typescript
interface DebateRound {
  roundNumber: number
  critiques: Critique[]        // From each participating agent
  synthesis: string            // Combined refinements
  hasConsensus: boolean        // All agents agree spec is complete
  diffFromPrevious?: string    // What changed
}

interface Critique {
  agentType: AgentType
  persona: DebatePersona       // Security engineer, oncall, PM, etc.
  issues: Issue[]              // Gaps, assumptions, edge cases
  approved: boolean            // This agent thinks spec is ready
}
```

### Personas (Focus Modes)
- **Security Engineer**: Auth, injection, data exposure, permissions
- **Oncall Engineer**: Error handling, observability, failure modes, recovery
- **Product Manager**: User stories, acceptance criteria, scope creep
- **Performance Engineer**: Scalability, latency, resource constraints
- **QA Engineer**: Test coverage, edge cases, validation

## Architecture

### New Files
```
src/lib/debate/
├── orchestrator.ts      # Runs debate rounds, checks consensus
├── personas.ts          # Persona definitions and prompts
├── synthesis.ts         # Merges critiques into refined spec
└── types.ts             # DebateRound, Critique, Persona types

src/components/debate/
├── debate-panel.tsx     # UI for viewing debate rounds
├── critique-card.tsx    # Single agent's critique
└── diff-view.tsx        # Changes between rounds
```

### Integration Points

**Task Planning (`/tasks`):**
- Add "Refine with Debate" button on task editor
- Opens debate panel, runs rounds until consensus
- Refined task replaces original

**Pre-Execution Hook:**
- Optional: Auto-debate before spawning agent
- Settings toggle: `ENABLE_PRE_EXECUTION_DEBATE`

**Code Review (post-completion):**
- When agent finishes, run multi-agent review
- Different agents critique the changes
- Surface issues before commit

## Debate Orchestrator

```typescript
// src/lib/debate/orchestrator.ts

interface DebateConfig {
  maxRounds: number           // Default: 5
  requiredForConsensus: number // How many agents must approve
  agents: AgentType[]         // Which agents participate
  focusAreas?: DebatePersona[] // Optional: limit critique scope
}

class DebateOrchestrator {
  async runDebate(
    spec: string,
    config: DebateConfig
  ): AsyncGenerator<DebateRound> {
    let currentSpec = spec
    let round = 0

    while (round < config.maxRounds) {
      round++

      // 1. Get critiques in parallel from all agents
      const critiques = await Promise.all(
        config.agents.map(agent =>
          this.getCritique(agent, currentSpec, config.focusAreas)
        )
      )

      // 2. Check consensus
      const approvedCount = critiques.filter(c => c.approved).length
      const hasConsensus = approvedCount >= config.requiredForConsensus

      // 3. Synthesize feedback into refined spec
      const synthesis = hasConsensus
        ? currentSpec
        : await this.synthesize(currentSpec, critiques)

      const debateRound: DebateRound = {
        roundNumber: round,
        critiques,
        synthesis,
        hasConsensus,
        diffFromPrevious: diff(currentSpec, synthesis)
      }

      yield debateRound

      if (hasConsensus) break
      currentSpec = synthesis
    }
  }

  private async getCritique(
    agentType: AgentType,
    spec: string,
    focusAreas?: DebatePersona[]
  ): Promise<Critique> {
    const persona = this.assignPersona(agentType, focusAreas)
    const prompt = this.buildCritiquePrompt(spec, persona)

    // Use existing agent infrastructure
    const response = await this.queryAgent(agentType, prompt)
    return this.parseCritique(response, agentType, persona)
  }
}
```

## Persona Prompts

```typescript
// src/lib/debate/personas.ts

export const PERSONA_PROMPTS: Record<DebatePersona, string> = {
  security: `You are a security engineer reviewing this spec.
Focus on: authentication, authorization, input validation,
data exposure, injection vectors, secret handling.
List specific vulnerabilities or gaps.`,

  oncall: `You are an oncall engineer who will be paged for this.
Focus on: error handling, logging, metrics, alerting,
failure modes, rollback procedures, runbook needs.
What will break at 3am?`,

  pm: `You are a product manager reviewing this spec.
Focus on: user stories completeness, acceptance criteria,
scope clarity, edge cases in user flows, missing requirements.
What will users complain about?`,

  performance: `You are a performance engineer reviewing this spec.
Focus on: scalability bottlenecks, latency concerns,
resource usage, caching opportunities, N+1 queries.
What will fall over at 10x load?`,

  qa: `You are a QA engineer reviewing this spec.
Focus on: testability, edge cases, boundary conditions,
integration points, data validation, state transitions.
What test cases are missing?`
}
```

## UI Integration

### Task Editor Addition
```tsx
// In src/routes/tasks/-task-editor.tsx

<Button
  onClick={() => setShowDebatePanel(true)}
  variant="outline"
>
  Refine with Debate
</Button>

{showDebatePanel && (
  <DebatePanel
    initialSpec={taskContent}
    onComplete={(refinedSpec) => {
      setTaskContent(refinedSpec)
      setShowDebatePanel(false)
    }}
    config={{
      agents: ['claude', 'cerebras'],
      maxRounds: 5,
      focusAreas: selectedPersonas
    }}
  />
)}
```

### Debate Panel
```tsx
// src/components/debate/debate-panel.tsx

function DebatePanel({ initialSpec, onComplete, config }) {
  const [rounds, setRounds] = useState<DebateRound[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const startDebate = async () => {
    setIsRunning(true)
    const orchestrator = new DebateOrchestrator()

    for await (const round of orchestrator.runDebate(initialSpec, config)) {
      setRounds(prev => [...prev, round])
      if (round.hasConsensus) break
    }
    setIsRunning(false)
  }

  return (
    <div className="debate-panel">
      <div className="debate-header">
        <h3>Multi-Agent Debate</h3>
        <Button onClick={startDebate} disabled={isRunning}>
          {isRunning ? 'Debating...' : 'Start Debate'}
        </Button>
      </div>

      {rounds.map(round => (
        <RoundCard key={round.roundNumber} round={round} />
      ))}

      {rounds.length > 0 && rounds[rounds.length - 1].hasConsensus && (
        <Button onClick={() => onComplete(rounds[rounds.length - 1].synthesis)}>
          Accept Refined Spec
        </Button>
      )}
    </div>
  )
}
```

## Implementation Phases

### Phase 1: Core Debate Engine
- [ ] Create `src/lib/debate/` module
- [ ] Implement `DebateOrchestrator` with round management
- [ ] Define persona prompts
- [ ] Add critique parsing logic
- [ ] Implement synthesis (merge critiques into refined spec)

### Phase 2: Task Integration
- [ ] Add debate button to task editor
- [ ] Create `DebatePanel` component
- [ ] Wire up to existing agent infrastructure
- [ ] Store debate history with task

### Phase 3: Pre-Execution Hook
- [ ] Add settings toggle for auto-debate
- [ ] Hook into `AgentManager.spawn()` flow
- [ ] UI indicator when task was debate-refined

### Phase 4: Code Review Mode
- [ ] Post-completion debate trigger
- [ ] Different prompt structure for code review
- [ ] Integration with git diff display

## Cost Considerations

Each debate round queries N agents. With 3 agents and 5 max rounds:
- Worst case: 15 LLM calls per task refinement
- Typical (consensus in 2-3 rounds): 6-9 calls

Add cost tracking:
```typescript
interface DebateRound {
  // ...existing fields
  costEstimate: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
}
```

## Open Questions

1. **Which agents participate?** All available, or user-selectable subset?
2. **Consensus threshold?** All must approve, or majority?
3. **Persona assignment?** Fixed per agent type, or rotate?
4. **Synthesis model?** Same as critique agents, or dedicated synthesizer?
5. **Save debate history?** Store rounds for audit, or discard after refinement?
