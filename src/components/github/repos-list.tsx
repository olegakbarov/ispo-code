/**
 * GitHub repositories list
 * Browse user's repos and clone them
 */

import { useState } from "react"
import { trpc } from "@/lib/trpc-client"
import { Button } from "@/components/ui/button"
import { useWorkingDirStore } from "@/lib/stores/working-dir"

/** Build repo path - inlined to avoid importing server-only clone-service */
function getRepoPath(workingDir: string, owner: string, repo: string): string {
  return `${workingDir}/.ispo-code/repos/${owner}/${repo}`
}

interface ReposListProps {
  onClose?: () => void
}

export function ReposList({ onClose }: ReposListProps = {}) {
  const [cloning, setCloning] = useState<string | null>(null)
  const { data: session } = trpc.github.getSession.useQuery()
  const { data: repos, isLoading: loadingRepos } = trpc.github.listRepos.useQuery(undefined, {
    enabled: !!session?.authenticated,
  })
  const { data: clonedRepos } = trpc.github.listClonedRepos.useQuery()
  const { data: serverDir } = trpc.system.workingDir.useQuery()
  const cloneRepoMutation = trpc.github.cloneRepo.useMutation()
  const { setWorkingDir, setSelectedRepo } = useWorkingDirStore()

  const handleClone = async (owner: string, repo: string) => {
    try {
      setCloning(`${owner}/${repo}`)
      await cloneRepoMutation.mutateAsync({ owner, repo })
      // Success - repo is now cloned
    } catch (error) {
      console.error("Failed to clone:", error)
      alert(`Failed to clone ${owner}/${repo}`)
    } finally {
      setCloning(null)
    }
  }

  const handleOpen = (owner: string, repo: string, path: string) => {
    setWorkingDir(path)
    setSelectedRepo({ owner, repo })
    onClose?.()
  }

  if (!session?.authenticated) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Login with GitHub to access your repositories
      </div>
    )
  }

  if (loadingRepos) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">Loading repositories...</div>
    )
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">No repositories found</div>
    )
  }

  const clonedRepoMap = new Set(
    clonedRepos?.map((r) => `${r.owner}/${r.repo}`) || []
  )

  return (
    <div className="flex flex-col gap-2 p-4">
      {repos.map((repo) => {
        const repoKey = `${repo.owner}/${repo.name}`
        const isCloned = clonedRepoMap.has(repoKey)
        const isCloning = cloning === repoKey
        const repoPath = serverDir ? getRepoPath(serverDir, repo.owner, repo.name) : ""

        return (
          <div
            key={repoKey}
            className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{repo.full_name}</div>
                {repo.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {repo.description}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {repo.private && (
                    <span className="px-1.5 py-0.5 bg-accent rounded text-[10px]">Private</span>
                  )}
                  {repo.language && <span>{repo.language}</span>}
                  <span>★ {repo.stargazers_count}</span>
                </div>
              </div>
              <div className="shrink-0">
                {isCloned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpen(repo.owner, repo.name, repoPath)}
                  >
                    Open
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleClone(repo.owner, repo.name)}
                    disabled={isCloning}
                  >
                    {isCloning ? "Cloning..." : "Clone"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
