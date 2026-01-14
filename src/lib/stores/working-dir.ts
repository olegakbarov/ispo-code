/**
 * Working Directory Store
 *
 * Zustand store for managing the selected working directory.
 * Persists to localStorage so selection survives page refreshes.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface WorkingDirState {
  /** The currently selected working directory, or null to use server default */
  workingDir: string | null
  /** Update the working directory */
  setWorkingDir: (path: string | null) => void
}

export const useWorkingDirStore = create<WorkingDirState>()(
  persist(
    (set) => ({
      workingDir: null,
      setWorkingDir: (path) => set({ workingDir: path }),
    }),
    { name: "agentz-working-dir" }
  )
)

/**
 * Non-reactive getter for use outside React components.
 * Used by tRPC client to get current working dir for headers.
 */
export const getWorkingDir = () => useWorkingDirStore.getState().workingDir
