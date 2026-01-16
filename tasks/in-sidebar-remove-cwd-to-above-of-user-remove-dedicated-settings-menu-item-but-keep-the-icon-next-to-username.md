# in sidebar remove cwd to above of user. remove dedicated settings menu item but keep the icon next to username

## Problem Statement
Sidebar footer shows cwd panel above user; extra noise. Settings entry duplicated; keep settings icon in user menu only.

## Scope
**In:**
- remove cwd/project indicator from sidebar footer
- remove settings nav item; keep user menu icon/link
**Out:**
- change settings page content
- alter auth/session logic

## Implementation Plan

### Phase: Sidebar cleanup
- [x] Remove ProjectIndicator render + component from `src/components/layout/sidebar.tsx`
- [x] Remove Settings NavLink and unused imports in `src/components/layout/sidebar.tsx`

## Key Files
- `src/components/layout/sidebar.tsx` - remove cwd panel + settings nav item

## Success Criteria
- [x] Sidebar footer shows no cwd panel above user menu
- [x] Settings nav item absent; user menu still shows settings icon/link

## Implementation Notes
- Removed ProjectIndicator component and its render call
- Removed Settings NavLink from footer
- Removed unused imports: useState, FolderOpen, ChevronRight, Settings, FolderPicker, useWorkingDirStore
- Verified UserMenu component still has Settings icon and links to /settings page

## Unresolved Questions
- None
