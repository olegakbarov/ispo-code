# make all sidebars 25% wider

<!-- autoRun: true -->

## Completed

All sidebars widened by 25%:

| File | Original | New (25% wider) |
|------|----------|-----------------|
| `src/components/layout/sidebar.tsx` | `w-80` (320px) | `w-[400px]` |
| `src/components/agents/thread-sidebar.tsx` | `w-72` (288px) | `w-[360px]` |
| `src/routes/tasks/_page.tsx` | `w-80` (320px) | `w-[400px]` |
| `src/components/agents/task-list.tsx` | `w-80` (320px) | `w-[400px]` |
| `src/components/tasks/task-list.tsx` | `w-80` (320px) | `w-[400px]` |
| `src/components/tasks/task-review-panel.tsx` | `w-72` (288px) | `w-[360px]` |

- [x] Find all sidebar width definitions
- [x] Update main layout sidebar (320px → 400px)
- [x] Update thread/agent sidebars (288px → 360px)
- [x] Update task page sidebars
