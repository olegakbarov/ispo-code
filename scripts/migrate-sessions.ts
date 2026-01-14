/**
 * Migration script: Convert legacy sessions.json to durable streams
 *
 * Run with: npx tsx scripts/migrate-sessions.ts
 *
 * Prerequisites: Dev server must be running (npm run dev) so stream server is available
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { DurableStream } from '@durable-streams/client'

const LEGACY_SESSIONS_PATH = join(process.cwd(), 'src/data/sessions.json')
const STREAM_SERVER_URL = process.env.STREAM_SERVER_URL || 'http://localhost:4201'

interface LegacySession {
  id: string
  prompt: string
  status: string
  startedAt: string
  completedAt?: string
  workingDir: string
  output: Array<{
    type: string
    content: string
    timestamp: string
    metadata?: Record<string, unknown>
  }>
  agentType?: string
  model?: string
  metadata?: {
    editedFiles?: string[]
    createdFiles?: string[]
    commands?: string[]
  }
  tokensUsed?: {
    input: number
    output: number
  }
  cliSessionId?: string
  taskPath?: string
  error?: string
}

interface SessionsData {
  sessions: LegacySession[]
}

function getStreamHandle(path: string): DurableStream {
  return new DurableStream({
    url: `${STREAM_SERVER_URL}${path}`,
    contentType: 'application/json',
  })
}

const createdStreams = new Set<string>()

async function ensureStreamExists(path: string): Promise<void> {
  if (createdStreams.has(path)) return

  const handle = getStreamHandle(path)
  try {
    await handle.create()
    createdStreams.add(path)
  } catch (err: unknown) {
    // Stream might already exist (409 Conflict) - that's fine
    if (err && typeof err === 'object' && 'code' in err && err.code === 'CONFLICT_EXISTS') {
      createdStreams.add(path)
      return
    }
    throw err
  }
}

async function appendToStream(path: string, event: unknown): Promise<void> {
  await ensureStreamExists(path)
  const handle = getStreamHandle(path)
  await handle.append([JSON.stringify(event)])
}

async function migrateSession(session: LegacySession): Promise<void> {
  const { id, prompt, status, startedAt, completedAt, workingDir, output, agentType, model, metadata, tokensUsed, cliSessionId, taskPath, error } = session

  // 1. Create registry event: session_created
  await appendToStream('/__registry__', {
    type: 'session_created',
    sessionId: id,
    agentType: agentType || 'claude',
    prompt,
    workingDir,
    model,
    taskPath,
    timestamp: startedAt,
  })

  // 2. Append output chunks to session stream
  for (const chunk of output) {
    await appendToStream(`/sessions/${id}`, {
      type: 'output',
      chunk: {
        type: chunk.type,
        content: chunk.content,
        timestamp: chunk.timestamp,
        metadata: chunk.metadata,
      },
      timestamp: chunk.timestamp,
    })
  }

  // 3. Store CLI session ID if present
  if (cliSessionId) {
    await appendToStream(`/sessions/${id}`, {
      type: 'cli_session_id',
      cliSessionId,
      timestamp: startedAt,
    })
  }

  // 4. Create final status event in registry
  if (status === 'completed') {
    await appendToStream('/__registry__', {
      type: 'session_completed',
      sessionId: id,
      metadata,
      tokensUsed,
      timestamp: completedAt || new Date().toISOString(),
    })
  } else if (status === 'failed') {
    await appendToStream('/__registry__', {
      type: 'session_failed',
      sessionId: id,
      error: error || 'Unknown error',
      metadata,
      timestamp: completedAt || new Date().toISOString(),
    })
  } else if (status === 'cancelled') {
    await appendToStream('/__registry__', {
      type: 'session_cancelled',
      sessionId: id,
      timestamp: completedAt || new Date().toISOString(),
    })
  } else if (status === 'running' || status === 'pending' || status === 'working') {
    // Mark stale running sessions as failed (since they're not actually running)
    await appendToStream('/__registry__', {
      type: 'session_failed',
      sessionId: id,
      error: 'Session was interrupted (migrated from legacy system)',
      metadata,
      timestamp: new Date().toISOString(),
    })
  }
}

async function main() {
  console.log('=== Legacy Sessions Migration ===\n')

  // Check if legacy file exists
  if (!existsSync(LEGACY_SESSIONS_PATH)) {
    console.error('No legacy sessions file found at:', LEGACY_SESSIONS_PATH)
    process.exit(1)
  }

  // Check stream server is running
  try {
    await fetch(`${STREAM_SERVER_URL}/__registry__`)
    // Any response means server is up (even 404 for empty stream)
  } catch {
    console.error('Stream server not reachable at:', STREAM_SERVER_URL)
    console.error('Make sure the dev server is running: npm run dev')
    process.exit(1)
  }

  // Load legacy sessions
  const raw = readFileSync(LEGACY_SESSIONS_PATH, 'utf-8')
  const data: SessionsData = JSON.parse(raw)

  console.log(`Found ${data.sessions.length} sessions to migrate\n`)

  let migrated = 0
  let failed = 0

  for (const session of data.sessions) {
    process.stdout.write(`Migrating ${session.id}... `)
    try {
      await migrateSession(session)
      console.log('OK')
      migrated++
    } catch (err) {
      console.log('FAILED:', err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log(`\n=== Migration Complete ===`)
  console.log(`Migrated: ${migrated}`)
  console.log(`Failed: ${failed}`)

  if (migrated > 0) {
    console.log('\nYour sessions should now appear in the sidebar!')
  }
}

main().catch(console.error)
