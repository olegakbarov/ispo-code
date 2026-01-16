# move change theme to sessings and merge current main page with new task modal

## Status: ✅ Completed

## Summary

Successfully moved the theme toggle from the Sidebar header to the Settings page. The new task modal was already merged into the main page in a previous commit.

## Changes Made

### 1. Updated Settings Page (`src/routes/settings.tsx`)
- [x] Added imports for `Moon`, `Sun` icons and `useTheme` hook
- [x] Created new "Theme" section at the top of settings
- [x] Implemented theme toggle buttons for Dark/Light modes
- [x] Styled buttons to show active state with border and background highlight
- [x] Positioned Theme section before Brand Color section for better UX

### 2. Updated Sidebar (`src/components/layout/sidebar.tsx`)
- [x] Removed theme toggle button from header
- [x] Removed unused imports: `Moon`, `Sun`, `useTheme`
- [x] Simplified header to show only the Agentz logo

## Notes

- The task modal merge was already completed in a previous commit (a4ccf13)
- The tasks index page now shows an inline create form when no task is selected
- Theme toggle is now accessible via Settings in the sidebar footer
