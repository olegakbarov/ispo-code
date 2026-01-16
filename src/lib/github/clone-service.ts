/**
 * GitHub repository cloning service
 * Clones repos to .agentz/repos/{owner}/{repo}
 */

import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs"
import * as path from "path"

const execAsync = promisify(exec)

export interface ClonedRepo {
  owner: string
  repo: string
  path: string
  exists: boolean
}

/**
 * Get the base directory for cloned repos
 */
export function getReposDir(workingDir: string): string {
  return path.join(workingDir, ".agentz", "repos")
}

/**
 * Get the full path for a cloned repo
 */
export function getRepoPath(workingDir: string, owner: string, repo: string): string {
  return path.join(getReposDir(workingDir), owner, repo)
}

/**
 * Check if a repo is already cloned
 */
export function isRepoCloned(workingDir: string, owner: string, repo: string): boolean {
  const repoPath = getRepoPath(workingDir, owner, repo)
  return fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, ".git"))
}

/**
 * Clone a GitHub repository using a personal access token
 */
export async function cloneRepo(
  workingDir: string,
  owner: string,
  repo: string,
  accessToken: string
): Promise<string> {
  const repoPath = getRepoPath(workingDir, owner, repo)

  // Check if already cloned
  if (isRepoCloned(workingDir, owner, repo)) {
    return repoPath
  }

  // Create parent directory
  const parentDir = path.dirname(repoPath)
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true })
  }

  // Clone using HTTPS with token
  const cloneUrl = `https://x-access-token:${accessToken}@github.com/${owner}/${repo}.git`

  try {
    await execAsync(`git clone "${cloneUrl}" "${repoPath}"`, {
      cwd: parentDir,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0", // Disable credential prompts
      },
    })

    // Configure git to use token for future operations
    await configureGitCredentials(repoPath, accessToken)

    return repoPath
  } catch (error) {
    // Clean up failed clone
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true })
    }
    throw new Error(`Failed to clone ${owner}/${repo}: ${error}`)
  }
}

/**
 * Configure git credentials for a cloned repo
 */
async function configureGitCredentials(repoPath: string, accessToken: string): Promise<void> {
  // Set up credential helper to use the access token
  const credentialHelper = `!f() { echo "username=x-access-token"; echo "password=${accessToken}"; }; f`

  await execAsync(`git config credential.helper "${credentialHelper}"`, {
    cwd: repoPath,
  })
}

/**
 * List all cloned repos in the .agentz/repos directory
 */
export function listClonedRepos(workingDir: string): ClonedRepo[] {
  const reposDir = getReposDir(workingDir)

  if (!fs.existsSync(reposDir)) {
    return []
  }

  const clonedRepos: ClonedRepo[] = []

  // Scan owner directories
  const owners = fs.readdirSync(reposDir).filter((name) => {
    const ownerPath = path.join(reposDir, name)
    return fs.statSync(ownerPath).isDirectory()
  })

  for (const owner of owners) {
    const ownerPath = path.join(reposDir, owner)
    const repos = fs.readdirSync(ownerPath).filter((name) => {
      const repoPath = path.join(ownerPath, name)
      return fs.statSync(repoPath).isDirectory()
    })

    for (const repo of repos) {
      const repoPath = path.join(ownerPath, repo)
      clonedRepos.push({
        owner,
        repo,
        path: repoPath,
        exists: fs.existsSync(path.join(repoPath, ".git")),
      })
    }
  }

  return clonedRepos
}

/**
 * Delete a cloned repo
 */
export async function deleteClonedRepo(
  workingDir: string,
  owner: string,
  repo: string
): Promise<void> {
  const repoPath = getRepoPath(workingDir, owner, repo)

  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true })
  }

  // Clean up empty owner directory
  const ownerPath = path.dirname(repoPath)
  if (fs.existsSync(ownerPath) && fs.readdirSync(ownerPath).length === 0) {
    fs.rmSync(ownerPath, { recursive: true })
  }
}
