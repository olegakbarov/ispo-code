import { getSessionStore } from "./session-store"
import { getStreamAPI } from "@/streams/client"

export async function getKnownSessionIds(): Promise<Set<string>> {
  const store = getSessionStore()
  const sessionIds = new Set(store.getAllSessions().map((session) => session.id))

  try {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()
    const deletedSessionIds = new Set<string>()

    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
        continue
      }
      sessionIds.add(event.sessionId)
    }

    for (const deletedId of deletedSessionIds) {
      sessionIds.delete(deletedId)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[session-index] Failed to read registry for worktree cleanup: ${message}`)
  }

  return sessionIds
}
