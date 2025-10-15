# Plugin Architecture

This document explains the structure of the `@milkdown-agent/suggestion-plugin`.

## Directory Structure

```
src/
├── index.ts              # Public API - all exports
├── types.ts              # TypeScript type definitions
├── context.ts            # Context keys for plugin state
├── plugin.ts             # Main plugin composition
├── schema/
│   ├── node.ts          # Suggestion node schema definition
│   └── view.ts          # NodeView with inline controls
├── commands/
│   ├── insert.ts        # Insert suggestion command
│   ├── accept.ts        # Accept suggestion command
│   ├── reject.ts        # Reject suggestion command
│   └── batch.ts         # Batch accept/reject commands
└── utils/
    ├── collect.ts       # Collect suggestions from document
    └── helpers.ts       # Helper functions (lock/unlock, etc.)
```

## Design Principles

### 1. **Single Responsibility**
Each file has one clear purpose:
- `node.ts` - Only defines the ProseMirror node schema
- `accept.ts` - Only handles accepting suggestions
- `collect.ts` - Only collects suggestions from the document

### 2. **Clean Public API**
`index.ts` is the only public interface. It exports:
- Main plugin function
- Types for TypeScript users
- Utility functions
- Command keys for advanced usage

### 3. **Testability**
Each command and utility can be tested independently:
```typescript
import { acceptSuggestionCommand } from './commands/accept';
// Test in isolation
```

### 4. **Discoverability**
Contributors can easily find what they need:
- Need to modify accept logic? → `commands/accept.ts`
- Need to change node rendering? → `schema/view.ts`
- Need to add a utility? → `utils/`

### 5. **Scalability**
Easy to add new features:
- New command? → Add file to `commands/`
- New utility? → Add file to `utils/`
- New node type? → Add file to `schema/`

## Adding New Features

### Adding a New Command

1. Create `src/commands/your-command.ts`:
```typescript
import { createCmdKey } from '@milkdown/core';
import { $command } from '@milkdown/utils';

export const YourCommand = createCmdKey('YourCommand');

export const yourCommand = $command('YourCommand', (ctx) => () => {
  // Your logic here
});
```

2. Export from `src/plugin.ts`:
```typescript
import { yourCommand } from './commands/your-command';

export const agentSuggestion = (callbacks?) => [
  // ... existing plugins
  yourCommand,
];
```

3. Export from `src/index.ts`:
```typescript
export { YourCommand } from './commands/your-command';
```

### Adding a New Utility

1. Add to `src/utils/your-utility.ts`
2. Export from `src/index.ts`

## File Size Guidelines

- **Keep files under 200 lines** when possible
- If a file grows beyond 300 lines, consider splitting it
- Each command should be ~50-100 lines

## Dependencies

- Minimize cross-file dependencies
- Commands should import from `schema/` and `context`, not from each other
- Utilities should be pure functions when possible

## Testing Strategy

```
tests/
├── commands/
│   ├── insert.test.ts
│   ├── accept.test.ts
│   └── reject.test.ts
├── utils/
│   └── collect.test.ts
└── integration/
    └── plugin.test.ts
```

## Benefits of This Structure

1. **Easy to navigate** - Clear folder structure
2. **Easy to test** - Small, focused files
3. **Easy to contribute** - Know exactly where to add code
4. **Easy to review** - PRs touch specific files
5. **Easy to maintain** - Changes are isolated
