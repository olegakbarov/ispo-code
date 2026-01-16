# redesign the user control. should open settings on click

## Problem Statement
User control = avatar dropdown only; no direct settings entry
Need click to open settings, clearer control affordance

## Scope
**In:**
- user control UI redesign in sidebar
- click behavior routes to `/settings`
- keep auth state handling intact
**Out:**
- settings page content changes
- auth flow changes beyond UI
- new settings features

## Implementation Plan

### Phase: Discovery
- [x] Review `src/components/auth/user-menu.tsx`
- [x] Check user control placement in `src/components/layout/sidebar.tsx`

### Phase: Redesign + Behavior
- [x] Redesign user control markup/styles in `src/components/auth/user-menu.tsx`
- [x] Wire user control click to `/settings`
- [x] Preserve sign-out access or move to settings if required

### Phase: Verify
- [x] Confirm click navigates to settings
- [x] Confirm unauthenticated state unchanged

## Key Files
- `src/components/auth/user-menu.tsx` - redesign and click behavior
- `src/components/layout/sidebar.tsx` - placement/props
- `src/routes/settings.tsx` - target route reference (added AccountSection with sign-out)
- `src/styles.css` - shared styles if needed

## Success Criteria
- [x] Clicking user control routes to `/settings`
- [x] User control visuals updated per redesign
- [x] Sign-out still accessible for authed users

## Implementation Notes
- Replaced dropdown-based UserMenu with a Link component that navigates to /settings
- Added "Account settings" subtitle and Settings icon as visual affordances
- Moved sign-out functionality to new AccountSection in settings page
- AccountSection only renders for authenticated users (same behavior as before)
