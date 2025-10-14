# @milkdown-agent/suggestion-plugin

Agent-friendly suggestion highlighting for [Milkdown](https://milkdown.dev) editors. The extension renders inline diff blocks with accept/reject commands so humans can review AI generated edits.

## Features

- 🔒 Locks the editor in review-only mode while still allowing programmatic updates via suggestions.
- 🪄 Presents changes as inline diff spans mirroring the Tiptap diff suggestion UX.
- ✅ Provides commands to accept/reject individual or batched suggestions.
- 🧩 Framework-agnostic API so you can wire suggestions from any backend transport.

## Installation

```bash
npm install @milkdown-agent/suggestion-plugin
```

Peer dependencies:

```bash
npm install @milkdown/core @milkdown/prose
```

## Quick start

```ts
import { Editor, rootCtx } from '@milkdown/core';
import { agentSuggestion, lockEditor } from '@milkdown-agent/suggestion-plugin';

const editor = await Editor.make()
  .config((ctx) => {
    ctx.set(rootCtx, document.getElementById('app'));
    lockEditor(ctx); // make the editor review-only by default
  })
  .use(agentSuggestion())
  .create();
```

Later you can inject suggestions from an agent service:

```ts
import { insertSuggestion, acceptSuggestion } from '@milkdown-agent/suggestion-plugin';

editor.action(insertSuggestion({
  id: 'suggestion-1',
  from: 15,
  to: 30,
  newText: 'Updated replacement paragraph.'
}));

// On approve button click
editor.action(acceptSuggestion('suggestion-1'));
```

See the repository README for a full walkthrough including a React demo and CodePen playground.
