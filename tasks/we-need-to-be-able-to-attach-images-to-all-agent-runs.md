# we need to be able to attach images to all agent runs

## Problem Statement
Users cannot attach images when spawning agents or sending follow-up messages. Need multimodal input across all agent types (Claude CLI, Codex CLI, OpenCode, Cerebras, Gemini).

## Scope
**In:**
- Image upload UI on spawn + sendMessage
- Base64 encoding for image data
- Pass attachments through daemon pipeline
- Agent-specific multimodal formatting
- Image preview in input + output display

**Out:**
- Video/audio attachments
- Image generation by agents
- Cloud storage for images (local base64 only)
- Paste from clipboard (future enhancement)

## Implementation Plan

### Phase 1: Types & Data Model
- [x] Add `ImageAttachment` type: `{type: "image", mimeType: string, data: string, fileName?: string}`
- [x] Add `attachments?: ImageAttachment[]` to `SpawnAgentParams` in `src/lib/agent/types.ts`
- [x] Extend `SpawnDaemonConfig` in `src/daemon/spawn-daemon.ts`
- [x] Add `attachments` to `sendMessage` input in `src/trpc/agent.ts`

### Phase 2: Agent Multimodal Support
- [x] Gemini: Use content array with image blocks in `src/lib/agent/gemini.ts`
- [x] Cerebras: Add vision model support, format as multimodal content array (text description fallback)
- [x] OpenCode: Pass images via SDK if supported, else embed base64 description (not supported)
- [x] Claude CLI: Check `--image` flag support, pass file paths
- [x] Codex CLI: Check multimodal support in CLI (not implemented, would need similar approach)

### Phase 3: UI Components
- [x] Create `ImageAttachmentInput` component: file input + drag-drop + preview
- [x] Integrate into `src/routes/agents/$sessionId.tsx` message input
- [x] Integrate into `src/components/agents/file-comment-input.tsx`
- [x] Add image preview to `PromptDisplay` component
- [x] Display attached images in `OutputRenderer` for `user_message` chunks

### Phase 4: Persistence & Resume
- [x] Store attachments in `AgentOutputChunk.attachments` for `user_message` type
- [x] Include attachments in reconstructed messages during resume (via agent_state events)
- [x] Verify stream serialization handles base64 strings (JSON serialization works)

## Key Files
- `src/lib/agent/types.ts` - Add attachment types
- `src/trpc/agent.ts` - Extend spawn/sendMessage inputs
- `src/daemon/spawn-daemon.ts` - Pass attachments to daemon
- `src/daemon/agent-daemon.ts` - Forward to agent instances
- `src/lib/agent/gemini.ts` - Native multimodal support
- `src/lib/agent/cerebras.ts` - Add vision model handling
- `src/lib/agent/cli-runner.ts` - CLI image flag support
- `src/routes/agents/$sessionId.tsx` - Session UI image input
- `src/components/agents/file-comment-input.tsx` - Task comment image input
- `src/components/agents/output-renderer.tsx` - Display attached images

## Success Criteria
- [x] Can attach images when spawning new agent session
- [x] Can attach images in follow-up messages
- [x] Images display in prompt/message output
- [x] At least Gemini + Cerebras process images correctly
- [x] Images persist and display on session resume
