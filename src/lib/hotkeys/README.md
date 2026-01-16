# Global Hotkeys System

A centralized keyboard shortcut system for app-wide navigation and task actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        keymap.ts                            │
│  Defines all available hotkeys with route patterns          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      use-hotkeys.ts                         │
│  Hook for registering hotkey handlers with event matching   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────┴───────────────────┐
        │                                         │
        ▼                                         ▼
┌───────────────────────┐             ┌─────────────────────┐
│ GlobalHotkeysProvider │             │   TasksPage         │
│  Navigation hotkeys   │             │   Task actions      │
└───────────────────────┘             └─────────────────────┘
```

## Available Hotkeys

### Navigation (Global)

- **Cmd/Ctrl+F**: Focus task filter input
- **g t**: Go to tasks page

### Task Actions (Only on `/tasks` routes)

- **c**: Create new task (any tasks route)
- **i**: Implement selected task (requires task selection)
- **v**: Verify selected task (requires task selection)
- **r**: Review selected task (requires task selection)

## Key Features

### Smart Input Detection
Hotkeys are automatically disabled when typing in inputs/textareas, except for Cmd/Ctrl+F which is a common search pattern users expect to work everywhere.

### Route-Based Activation
Hotkeys can be scoped to specific routes using regex patterns:
```typescript
{
  keys: 'i',
  routePattern: /^\/tasks\/.+/,  // Only active when task is selected
}
```

### Platform-Aware
Key combinations support platform alternatives:
```typescript
keys: 'cmd+f,ctrl+f'  // Cmd on Mac, Ctrl on Windows/Linux
```

### Agent-Aware
Task action hotkeys check for active agent sessions and are disabled if an agent is running.

## Usage

### Adding a New Global Hotkey

1. **Define in keymap** (`src/lib/hotkeys/keymap.ts`):
```typescript
export const KEYMAP = {
  MY_ACTION: {
    keys: 'cmd+k,ctrl+k',
    description: 'My custom action',
    category: 'general',
    routePattern: /^\/my-route/,  // Optional
  },
  // ...
}
```

2. **Register in provider** (`src/components/hotkeys/global-hotkeys-provider.tsx`):
```typescript
useHotkey({
  keys: KEYMAP.MY_ACTION.keys,
  handler: () => {
    // Your action
  },
  enabled: isHotkeyActive(KEYMAP.MY_ACTION, pathname),
  preventDefault: true,
})
```

### Adding Component-Specific Hotkeys

Use the `useHotkey` hook directly in your component:

```typescript
import { useHotkey } from '@/lib/hooks/use-hotkeys'

function MyComponent() {
  useHotkey({
    keys: 'cmd+s,ctrl+s',
    handler: () => handleSave(),
    preventDefault: true,
    enabled: isDirty,  // Optional conditional
  })
}
```

## Implementation Details

### Key Matching Algorithm

The `matchesKeys` function in `use-hotkeys.ts`:
1. Parses comma-separated alternatives
2. Splits modifiers from the main key
3. Checks exact key match (case-insensitive)
4. Verifies all required modifiers are pressed
5. Ensures no extra modifiers are active

### Focus Targets

Components can expose hotkey targets using data attributes:
```tsx
<Input data-hotkey-target="task-filter" />
```

The provider can then focus these elements:
```typescript
const filterInput = document.querySelector('[data-hotkey-target="task-filter"]')
filterInput?.focus()
```

## Testing Considerations

When testing components with hotkeys:
- Mock the `useHotkey` hook
- Simulate KeyboardEvent with appropriate modifiers
- Test route pattern matching separately
- Verify disabled state when typing in inputs

## Future Enhancements

Potential improvements (currently out of scope):
- User-configurable keybindings UI
- Hotkey cheat sheet overlay (press `?`)
- Per-editor shortcuts beyond existing handlers
- Hotkey recording interface
