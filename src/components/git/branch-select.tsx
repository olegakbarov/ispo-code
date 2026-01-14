/**
 * BranchSelect - Branch dropdown with create new branch option
 */

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface BranchSelectProps {
  current: string
  branches: string[]
  onCheckout: (branch: string) => Promise<void>
  onCreate: (branch: string) => Promise<void>
}

export function BranchSelect({
  current,
  branches,
  onCheckout,
  onCreate,
}: BranchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowNewBranch(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase())
  )

  const handleCheckout = async (branch: string) => {
    if (branch === current) return
    setIsLoading(true)
    try {
      await onCheckout(branch)
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newBranchName.trim()) return
    setIsLoading(true)
    try {
      await onCreate(newBranchName.trim())
      setNewBranchName('')
      setShowNewBranch(false)
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-2 py-1 bg-panel border border-border rounded cursor-pointer hover:border-text-muted transition-colors disabled:opacity-50 min-w-[140px]"
      >
        <BranchIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span className="font-vcr text-xs text-text-primary truncate flex-1 text-left">
          {isLoading ? 'Loading...' : current || 'Select branch'}
        </span>
        <ChevronIcon className="w-3 h-3 text-text-muted shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-panel border border-border rounded shadow-lg z-50">
          {/* Search */}
          <div className="p-1.5 border-b border-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find branch..."
              variant="sm"
              className="bg-background"
              autoFocus
            />
          </div>

          {/* Branch List */}
          <div className="max-h-40 overflow-y-auto">
            {filteredBranches.length === 0 ? (
              <div className="p-2 text-xs text-text-muted text-center">
                No branches found
              </div>
            ) : (
              filteredBranches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => handleCheckout(branch)}
                  className={`w-full px-2.5 py-1.5 text-left text-xs cursor-pointer transition-colors ${
                    branch === current
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-primary hover:bg-panel-hover'
                  }`}
                >
                  {branch}
                  {branch === current && (
                    <span className="ml-2 text-text-muted">(current)</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* New Branch Section */}
          <div className="border-t border-border p-1.5">
            {showNewBranch ? (
              <div className="flex gap-1.5">
                <Input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="New branch name..."
                  variant="sm"
                  className="flex-1 bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') setShowNewBranch(false)
                  }}
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={!newBranchName.trim()}
                  className="px-2 py-1 bg-accent text-background font-vcr text-xs rounded cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewBranch(true)}
                className="w-full px-2 py-1 text-xs text-accent hover:bg-panel-hover rounded cursor-pointer text-left"
              >
                + New branch
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"
      />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z"
      />
    </svg>
  )
}
