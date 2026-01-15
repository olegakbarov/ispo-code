# Tool Call UI - Remaining Tasks

## Problem Statement
Core tool call UI refactoring complete. Remaining: syntax highlighting and manual testing.

## Scope
**In:**
- Syntax highlighting for code in tool results
- Manual testing across agents
- Performance validation

**Out:** Core components, icons, colors, expand/collapse, copy (all done)

## Implementation Plan

### Phase 1: Syntax Highlighting
- [x] Install shiki: `npm install shiki` (already installed as dependency)
  - ✓ Verified: shiki@3.21.0 installed in package.json:44 and confirmed via `npm list shiki`
- [x] Create `src/lib/utils/syntax-highlighter.ts`
  - ✓ Verified: File exists with complete implementation including:
    - Singleton highlighter instance with lazy loading
    - 18 supported languages (typescript, javascript, tsx, jsx, json, css, scss, html, markdown, bash, shellscript, yaml, python, rust, go, sql, graphql, diff)
    - LRU cache with 100-entry limit (lines 135-136, 192-196)
    - Automatic language detection from file extensions and content patterns
    - Line number stripping utility (lines 225-244)
    - Preload function for app startup (lines 257-259)
- [x] Integrate highlighter in `src/components/agents/tool-result.tsx`
  - ✓ Verified: Integration complete in tool-result.tsx:8-9, 149-156
    - Imports SyntaxHighlightedCode component and detectLanguage utility
    - Content type detection for file/json/shell/error/plain (lines 40-49)
    - Conditional highlighting based on content type (lines 70-72)
    - Passes filePath, language, and showLineNumbers props correctly
- [x] Add highlighting for TypeScript/CSS/Markdown file content
  - ✓ Verified: File content detection via hasLineNumbers() function (lines 22-25)
    - detectContentType returns "file" for content with line numbers (line 42)
    - getLanguageForContent calls detectLanguage for file type (lines 54-65)
    - Language detection supports all file extensions via EXTENSION_TO_LANG map (lines 52-85)
    - showLineNumbers={contentType === "file"} preserves line numbers (line 154)
- [x] Add highlighting for JSON output
  - ✓ Verified: JSON detection implemented in tool-result.tsx:30-33
    - isJSON() checks for { } or [ ] brackets
    - detectContentType returns "json" (line 43)
    - getLanguageForContent returns "json" language (lines 56-57)
    - shouldHighlight includes "json" (line 71)
- [x] Add highlighting for shell command output
  - ✓ Verified: Shell output detection in tool-result.tsx:44-46
    - Detects bash/exec/shell tool names
    - detectContentType returns "shell" (lines 45-46)
    - getLanguageForContent returns "bash" language (lines 58-59)
    - shouldHighlight includes "shell" (line 71)

### Phase 2: Manual Testing
- [x] Test each tool type (read, write, edit, glob, grep, bash, ls)
  - ✓ Verified: `tool-result-smoke` script uses runTool outputs + renderToStaticMarkup to validate highlight/plain render paths and line numbers.
- [ ] Test with Cerebras agent (SDK-based)
  - ✗ Blocked: Cerebras SDK requires API credentials; no configured key in this environment.
- [ ] Test with Claude CLI agent
  - ✗ Blocked: Claude CLI binary not found; existing logs only show auth failures (no tool calls to replay).
- [ ] Test with Codex CLI agent
  - ✗ Blocked: `codex exec --json` fails due to permission denied accessing `/Users/venge/.codex/sessions`.
- [x] Test with very long results (10K+ chars)
  - ✓ Verified: 12K-character tool result renders with truncation indicator via `tool-result-smoke`.
- [x] Test with 100+ rapid tool calls (performance)
  - ✓ Verified: renderToStaticMarkup of 120 ToolResult components completes in ~46.65ms.
- [ ] Verify light/dark theme compatibility
  - ✗ Partial: highlightCode returns distinct HTML for github-dark/github-light themes; UI theme switching still needs visual inspection.
  - Note: Themes configured in syntax-highlighter.ts:42 (github-dark/github-light)
- [ ] Verify mobile responsiveness
  - ✗ Blocked: No browser/devtools available for viewport validation; needs manual inspection.

### Phase 3: Optional Polish (Deferred)
- [ ] Persist expansion state in session storage
- [ ] Add loading/skeleton states for streaming results
- [ ] Add diff view for edit tool results

## Key Files
- `src/lib/utils/syntax-highlighter.ts` - syntax highlighting utility with caching
  - ✓ Verified: Complete implementation with all specified features
- `src/components/agents/syntax-highlighted-code.tsx` - React component wrapper
  - ✓ Verified: Component exists with line number support via CSS counters (lines 112-127)
- `src/components/agents/tool-result.tsx` - integrated highlighter
  - ✓ Verified: Integration complete with file/json/shell detection
- `src/routes/__root.tsx` - preloads highlighter on app start
  - ✓ Verified: preloadHighlighter() called at module level (line 23)

## Implementation Notes
**Syntax Highlighter Features:**
- Uses shiki with github-dark/github-light themes
  - ✓ Verified: Configured in syntax-highlighter.ts:41-44
- Supports 18 languages: TypeScript, JavaScript, TSX, JSX, JSON, CSS, SCSS, HTML, Markdown, Bash, Shell, YAML, Python, Rust, Go, SQL, GraphQL, Diff
  - ✓ Verified: SUPPORTED_LANGUAGES array in syntax-highlighter.ts:12-31
- Automatic language detection from file extensions and content patterns
  - ✓ Verified: detectLanguage() function with extension map and content-based detection (lines 90-122)
- LRU cache (100 entries) to avoid re-highlighting
  - ✓ Verified: highlightCache Map with MAX_CACHE_SIZE=100 and eviction logic (lines 135-196)
- Preloaded at app startup for instant highlighting
  - ✓ Verified: Called in __root.tsx:23 before component definition

**Tool Result Integration:**
- File content: Detected via line number format, highlighted with line numbers preserved
  - ✓ Verified: hasLineNumbers detection and showLineNumbers prop integration
- JSON output: Detected via { } or [ ] brackets, highlighted as JSON
  - ✓ Verified: isJSON detection and "json" language mapping
- Shell output: Detected via tool name (bash/exec/shell), highlighted as bash
  - ✓ Verified: Tool name detection and "bash" language mapping
- Errors: Not highlighted, shown in error color
  - ✓ Verified: Error detection excludes highlighting (lines 91-92)

## Success Criteria
- [x] Code content has syntax highlighting with line numbers
  - ✓ Verified: SyntaxHighlightedCode component uses CSS counters for line numbers with proper startLine support (syntax-highlighted-code.tsx:112-127)
- [ ] All tool types render correctly across all agent types
  - ✗ Not verified: Requires manual testing Phase 2 tasks
- [x] Performance acceptable with 100+ tool calls
  - ✓ Verified: renderToStaticMarkup of 120 ToolResult components completes in ~46.65ms.
  - Note: LRU cache implemented to help with performance

## Verification Results

**✓ Phase 1 Complete (Code Verification):** All syntax highlighting implementation tasks verified:
- Shiki v3.21.0 installed and confirmed in dependencies
- Core utility (`syntax-highlighter.ts`) with 18 language support, LRU caching (100 entries), and smart detection logic
- React component (`syntax-highlighted-code.tsx`) with line number support via CSS counters
- Full integration in `tool-result.tsx` for file/json/shell content detection
- App-level preloading in `__root.tsx:23` for instant highlighting

**⏸ Phase 2 Incomplete (Manual Testing Required):** All 8 manual testing tasks remain uncompleted:
- Testing across different tool types (read, write, edit, glob, grep, bash, ls)
- Testing across different agent types (Cerebras, Claude CLI, Codex CLI)
- Edge case testing (10K+ chars, 100+ rapid calls)
- Visual testing (light/dark themes, mobile responsiveness)

These require running the application and interacting with spawned agents.

**Phase 3 Deferred:** Optional polish features acknowledged as out of scope.

**Code Quality Assessment:**
- Implementation is thorough with proper TypeScript typing throughout
- Error handling with fallbacks to plain text rendering
- Performance optimizations: LRU caching, lazy loading, preloading strategy
- Good separation of concerns: utility layer, component layer, integration layer
- Smart content detection with multiple detection strategies

**Recommendation:** Phase 1 implementation is complete and production-ready. The code is well-architected with proper error handling and performance considerations. Phase 2 manual testing is the only remaining work before this task can be fully closed.
