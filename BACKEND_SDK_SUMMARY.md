# Backend SDK: Just Parsing Helpers

## What It Is

**3 simple functions** for working with patch formats. That's it.

```typescript
import { parseDocument, serializePatches, validateMarkdown } from '@milkdown-agent/backend-sdk';
```

## The 3 Functions

### 1. parseDocument()

```typescript
const { document, patches } = parseDocument(
  textWithPatches,
  'aider' // or 'anthropic', 'unified-diff'
);
```

**Input**: Text with `<<<>>>` markers
**Output**: Clean document + parsed patches

### 2. serializePatches()

```typescript
const wireFormat = serializePatches(
  patches,
  'aider' // or 'anthropic', 'unified-diff'
);
```

**Input**: Patch objects
**Output**: Text with `<<<>>>` markers

### 3. validateMarkdown()

```typescript
const validation = validateMarkdown(document);
if (!validation.valid) {
  console.error(validation.errors);
}
```

**Input**: Markdown text
**Output**: Validation result

## What It's NOT

- ❌ Not a session manager
- ❌ Not an AI caller
- ❌ Not a retry handler
- ❌ Not a version tracker
- ❌ Not a state manager
- ❌ Not opinionated about your workflow

## You Handle

- **Version tracking** - Store in your DB/cache
- **AI calling** - Use your agent framework (LangGraph, LangChain, Vercel AI, etc.)
- **Retry logic** - Use your agent framework
- **State management** - Use your agent framework
- **Deciding patch vs full doc** - Your logic

## Example: LangGraph Integration

```typescript
import { parseDocument, serializePatches } from '@milkdown-agent/backend-sdk';
import { StateGraph } from '@langchain/langgraph';

interface AgentState {
  version: number;      // YOU track this
  document: string;
  patches: Patch[];
  snapshot: SyncSnapshot;
}

const graph = new StateGraph<AgentState>()
  .addNode('parse', (state) => {
    // Use SDK to parse
    const { document, patches } = parseDocument(
      state.snapshot.documentWithPatches,
      'aider'
    );
    return { ...state, document, patches };
  })
  .addNode('callAI', async (state) => {
    // YOU call AI
    const result = await llm.invoke({
      messages: [
        { role: 'user', content: `Improve: ${state.document}` }
      ]
    });
    return { ...state, patches: parseAIResponse(result) };
  })
  .addNode('serialize', (state) => {
    // Use SDK to serialize
    const wireFormat = serializePatches(state.patches, 'aider');
    return { ...state, wireFormat };
  });

// YOU manage version
app.post('/api/sync', async (req, res) => {
  const currentVersion = await db.get('version');
  
  if (req.body.version !== currentVersion) {
    res.json({
      ok: false,
      error: 'Version mismatch',
      serverVersion: currentVersion
    });
    return;
  }
  
  const result = await graph.invoke({
    version: currentVersion,
    document: '',
    patches: [],
    snapshot: req.body
  });
  
  // YOU increment version
  await db.set('version', currentVersion + 1);
  
  res.json({
    ok: true,
    version: currentVersion + 1,
    patches: result.wireFormat
  });
});
```

## Summary

**Backend SDK = Parsing helpers**

- Parse `<<<>>>` markers
- Serialize patches
- Validate markdown

**Everything else = Your responsibility**

This keeps the SDK minimal, unopinionated, and compatible with any agent framework.
