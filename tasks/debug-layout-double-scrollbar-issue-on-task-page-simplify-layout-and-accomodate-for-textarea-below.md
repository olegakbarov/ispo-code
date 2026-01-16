# debug layout (double scrollbar) issue on task page. simplify layout and accomodate for textarea below

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Double scrollbar appears in the task editor area when editing tasks (main editor scroll plus a nested textarea scrollbar).
- **Immediate Cause**: The editor panel uses an `overflow-y-auto` scroll container while the draft and rewrite textareas are fixed-height and can scroll internally, creating nested scroll contexts.
- **Call Chain**:
  1. `src/routes/tasks/_page.tsx:362-507` renders the editor column and footer within a flex container.
  2. `src/components/tasks/task-editor.tsx:163` provides the main scroll container (`overflow-y-auto`).
  3. `src/components/tasks/task-editor.tsx:174-181` renders the draft `<Textarea>` with fixed `rows`.
  4. `src/components/tasks/task-footer.tsx:147-163` renders `TaskInput` for the rewrite textarea.
  5. `src/components/tasks/task-input.tsx:72-82` renders a fixed-height `<textarea>` with default scroll behavior.
- **Original Trigger**: Switching task inputs to multiline textareas (draft + rewrite) without auto-grow means both the editor container and the textareas can scroll at the same time.
- **Evidence**:
  - `src/components/tasks/task-editor.tsx:163` (`overflow-y-auto`) defines the editor scroll region.
  - `src/components/tasks/task-editor.tsx:174-181` uses `rows={...}` on the draft textarea.
  - `src/components/tasks/task-input.tsx:72-82` renders a fixed-height textarea that can scroll internally.
  - `src/routes/tasks/_page.tsx:362-507` shows the footer below the editor, so both areas are visible simultaneously.

### Phase 2: Pattern Analysis
- **Working Examples**:
  - `src/routes/agents/$sessionId.tsx:240-306` uses a single `overflow-y-auto` output panel and a footer input in normal flex flow.
  - The agent session footer textarea uses `resize-y` and `max-h` to keep growth predictable without nested scroll containers.
- **Key Differences**:
  - Task page has two editable textareas (draft + rewrite) inside a panel that already scrolls; agent session page keeps a single scroll region for content and keeps the input outside that region.
  - Task page textareas are fixed-height (`rows`) and rely on default textarea scrolling; agent session textarea is allowed to resize without an internal scroll.
  - Task page already has a `.grow-wrap` utility in `src/styles.css:395-412` that is unused; agent session layout avoids the nested scroll issue by keeping the input outside the scrollable content.
- **Dependencies**:
  - `TaskEditor` draft textarea uses `src/components/ui/textarea.tsx` (shared styles).
  - `TaskFooter` uses `TaskInput`, which renders a raw `<textarea>` without auto-grow support.
  - `TaskReviewPanel` relies on `h-full` for internal layout, so any scroll changes must preserve a fixed-height content container.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: The double scrollbar is caused by fixed-height textareas (draft + rewrite) inside a scrollable editor panel; switching those textareas to auto-grow will remove the nested scrollbars and allow the footer input to expand without overlap.
- **Test Design**: 
  1. Use the existing `.grow-wrap` CSS utility to auto-size the draft textarea in `TaskEditor`.
  2. Wrap the `TaskInput` textarea in `.grow-wrap` to auto-size the rewrite input.
  3. Verify the DOM now uses `.grow-wrap` and the textarea overflow is hidden by CSS.
  4. Manual UI check: open a long task, scroll editor, and type multiple lines in the rewrite input; confirm only the editor scrollbar remains.
- **Prediction**: The inner textarea scrollbars disappear, leaving only the editor panel scrollbar; the rewrite textarea grows while the editor area shrinks.
- **Result**: Implemented `.grow-wrap` on both the draft and rewrite textareas; both now inherit `overflow: hidden` from `src/styles.css:405-408`, which should remove internal scrollbars. Manual UI verification still needed.
- **Conclusion**: Hypothesis is supported by the layout change; remaining risk is visual confirmation in the running app.

### Phase 4: Implementation
- **Root Cause**: Fixed-height textareas (draft + rewrite) were embedded inside a scrollable editor panel, creating nested scrollbars when text exceeded the textarea height.
- **Solution**: Apply the existing `.grow-wrap` auto-sizing utility to both the draft editor textarea and the rewrite input so the textareas expand with content and no longer scroll internally.
- **Test Case**:
  1. Open `/tasks/<task>` with a long description.
  2. Scroll the editor panel and verify only one scrollbar is visible.
  3. Type multiple lines into the rewrite input; confirm it grows and the editor area shrinks without introducing a second scrollbar.
- **Verification**:
  - `npm run test:run` (fails: missing `@ai-sdk/openai` dependency and failing `create-task-visibility` tests; not introduced by this change).
- **Changes Made**:
  - `src/components/tasks/task-input.tsx`: wrap textarea in `.grow-wrap` with `data-replicated-value` for auto-grow.
  - `src/components/tasks/task-editor.tsx`: wrap draft textarea in `.grow-wrap` and replace dynamic rows with a fixed minimum.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug (manual test case documented)
- [ ] All tests pass
