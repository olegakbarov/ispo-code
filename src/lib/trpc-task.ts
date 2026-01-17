export function taskTrpcOptions(taskPath?: string) {
  if (!taskPath) {
    return {}
  }

  return {
    trpc: {
      context: { taskPath },
    },
  }
}
