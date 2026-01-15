/**
 * Round Card Component
 * Displays a debate round with all critiques and synthesis results
 */

import { useState } from 'react'
import type { DebateRound } from '@/lib/debate/types'
import { CritiqueCard } from './critique-card'
import { calculateRoundStats } from '@/lib/debate/synthesis'

interface RoundCardProps {
  round: DebateRound
  /** Whether this is the most recent round */
  isLatest?: boolean
}

export function RoundCard({ round, isLatest = false }: RoundCardProps) {
  const [expanded, setExpanded] = useState(isLatest)
  const stats = calculateRoundStats(round)

  const approvalPercent = Math.round(stats.approvalRate * 100)

  return (
    <div className={`border rounded ${isLatest ? 'border-accent/50' : 'border-border'}`}>
      {/* Round Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-panel-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="font-vcr text-sm text-accent">Round {round.roundNumber}</span>
          {round.consensusReached && (
            <span className="px-2 py-0.5 rounded text-[10px] font-vcr bg-success/20 text-success border border-success/30">
              Consensus
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-[10px] text-text-muted">
          <span>{round.critiques.length} critics</span>
          <span>{approvalPercent}% approval</span>
          <span>
            {stats.criticalCount}C {stats.majorCount}M {stats.minorCount}m
          </span>
          <span className="font-vcr">{expanded ? '[-]' : '[+]'}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Critiques Grid */}
          <div className="p-3 space-y-3">
            {round.critiques.map((critique, i) => (
              <CritiqueCard key={i} critique={critique} expanded={true} />
            ))}
          </div>

          {/* Changes Summary */}
          {round.changesSummary && (
            <div className="p-3 border-t border-border bg-panel-hover/50">
              <div className="font-vcr text-xs text-text-muted mb-2">Changes Summary</div>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                {round.changesSummary}
              </pre>
            </div>
          )}

          {/* Refined Spec Preview (collapsed by default) */}
          {round.refinedSpec && (
            <RefinedSpecPreview spec={round.refinedSpec} />
          )}
        </div>
      )}
    </div>
  )
}

function RefinedSpecPreview({ spec }: { spec: string }) {
  const [showSpec, setShowSpec] = useState(false)

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setShowSpec(!showSpec)}
        className="w-full p-2 flex items-center justify-between text-xs text-text-muted hover:bg-panel-hover transition-colors cursor-pointer"
      >
        <span>Refined Spec ({spec.length} chars)</span>
        <span className="font-vcr">{showSpec ? '[-]' : '[+]'}</span>
      </button>
      {showSpec && (
        <div className="p-3 border-t border-border max-h-64 overflow-auto">
          <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
            {spec}
          </pre>
        </div>
      )}
    </div>
  )
}
