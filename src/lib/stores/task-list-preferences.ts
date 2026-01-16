/**
 * Task List Preferences Store
 *
 * Zustand store for task list filter/sort preferences.
 * Persists to localStorage so preferences survive page refreshes.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ArchiveFilter = 'all' | 'active' | 'archived'
export type SortOption = 'updated' | 'title' | 'progress'
export type SortDirection = 'asc' | 'desc'

interface TaskListPreferencesState {
  /** Archive filter preference */
  archiveFilter: ArchiveFilter
  /** Update archive filter */
  setArchiveFilter: (filter: ArchiveFilter) => void

  /** Sort by field */
  sortBy: SortOption
  /** Update sort by field */
  setSortBy: (sortBy: SortOption) => void

  /** Sort direction */
  sortDir: SortDirection
  /** Update sort direction */
  setSortDir: (sortDir: SortDirection) => void
}

export const useTaskListPreferences = create<TaskListPreferencesState>()(
  persist(
    (set) => ({
      archiveFilter: 'active',
      setArchiveFilter: (filter) => set({ archiveFilter: filter }),

      sortBy: 'updated',
      setSortBy: (sortBy) => set({ sortBy }),

      sortDir: 'desc',
      setSortDir: (sortDir) => set({ sortDir }),
    }),
    { name: "ispo-code-task-list-prefs" }
  )
)

/**
 * Non-reactive getter for use outside React components.
 */
export const getTaskListPreferences = () => useTaskListPreferences.getState()
