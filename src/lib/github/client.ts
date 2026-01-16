/**
 * GitHub API client wrapper using Octokit
 */

import { Octokit } from "octokit"

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: string
  description: string | null
  private: boolean
  html_url: string
  clone_url: string
  ssh_url: string
  default_branch: string
  updated_at: string | null
  language: string | null
  stargazers_count: number
}

/**
 * Create authenticated Octokit instance
 */
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken })
}

/**
 * List all repos accessible by the authenticated user
 */
export async function listUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const octokit = createGitHubClient(accessToken)

  const response = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
  })

  return response.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: repo.owner.login,
    description: repo.description,
    private: repo.private,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    ssh_url: repo.ssh_url,
    default_branch: repo.default_branch,
    updated_at: repo.updated_at,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
  }))
}

/**
 * Get details for a specific repo
 */
export async function getRepo(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  const octokit = createGitHubClient(accessToken)

  const response = await octokit.rest.repos.get({
    owner,
    repo,
  })

  const data = response.data
  return {
    id: data.id,
    name: data.name,
    full_name: data.full_name,
    owner: data.owner.login,
    description: data.description,
    private: data.private,
    html_url: data.html_url,
    clone_url: data.clone_url,
    ssh_url: data.ssh_url,
    default_branch: data.default_branch,
    updated_at: data.updated_at,
    language: data.language,
    stargazers_count: data.stargazers_count,
  }
}
