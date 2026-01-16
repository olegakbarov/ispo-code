/**
 * Task Navigation Hook
 *
 * Handles URL-based navigation for the tasks page:
 * - buildSearchParams for preserving filter/sort state
 * - Mode change navigation (edit/review/debate)
 * - Review file selection
 * - Navigation to split-from task
 */

import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { encodeTaskPath } from '@/lib/utils/task-routing'

type Mode = 'edit' | 'review' | 'debate'

interface UseTaskNavigationParams {
  selectedPath: string | null
  mode: Mode
  archiveFilter: 'all' | 'active' | 'archived'
  sortBy?: 'updated' | 'title' | 'progress'
  sortDir?: 'asc' | 'desc'
  reviewFile?: string
  splitFrom?: string
}

export function useTaskNavigation({
  selectedPath,
  mode,
  archiveFilter,
  sortBy,
  sortDir,
  reviewFile,
  splitFrom,
}: UseTaskNavigationParams) {
  const navigate = useNavigate()

  // ─────────────────────────────────────────────────────────────────────────────
  // Build Search Params
  // ─────────────────────────────────────────────────────────────────────────────

  const buildSearchParams = useCallback((overrideReviewFile?: string | null) => {
    const params: {
      archiveFilter: typeof archiveFilter
      sortBy?: typeof sortBy
      sortDir?: typeof sortDir
      reviewFile?: string
    } = { archiveFilter, sortBy, sortDir }

    // Include reviewFile if provided or if we're in review mode with an existing value
    const fileToUse = overrideReviewFile !== undefined ? overrideReviewFile : reviewFile
    if (fileToUse) {
      params.reviewFile = fileToUse
    }
    return params
  }, [archiveFilter, sortBy, sortDir, reviewFile])

  // ─────────────────────────────────────────────────────────────────────────────
  // Mode Change
  // ─────────────────────────────────────────────────────────────────────────────

  const handleModeChange = useCallback((newMode: Mode) => {
    if (!selectedPath) return
    // Clear reviewFile when leaving review mode
    const searchParams = newMode === 'review' ? buildSearchParams() : buildSearchParams(null)
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/${newMode}` },
      search: searchParams,
    })
  }, [selectedPath, navigate, buildSearchParams])

  // ─────────────────────────────────────────────────────────────────────────────
  // Review File Change
  // ─────────────────────────────────────────────────────────────────────────────

  const handleReviewFileChange = useCallback((file: string | null) => {
    if (!selectedPath || mode !== 'review') return
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/review` },
      search: buildSearchParams(file),
      replace: true, // Replace history entry to avoid polluting back button
    })
  }, [selectedPath, mode, navigate, buildSearchParams])

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigate to Split-From Task
  // ─────────────────────────────────────────────────────────────────────────────

  const handleNavigateToSplitFrom = useCallback(() => {
    if (!splitFrom) return

    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(splitFrom) },
      search: { archiveFilter: 'all', sortBy, sortDir },
    })
  }, [splitFrom, navigate, sortBy, sortDir])

  return {
    navigate,
    buildSearchParams,
    handleModeChange,
    handleReviewFileChange,
    handleNavigateToSplitFrom,
  }
}
