export function sessionTrpcOptions(sessionId?: string) {
  if (!sessionId) {
    return {}
  }

  return {
    trpc: {
      context: { sessionId },
    },
  }
}
