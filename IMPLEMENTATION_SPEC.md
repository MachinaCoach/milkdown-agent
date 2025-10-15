# Milkdown Agent Plugin: Implementation Spec

## Overview

A Milkdown plugin providing a Windsurf-like experience for AI-assisted editing with visual diff tracking, granular patch control, and flexible sync patterns.

**Two modes**:
1. **Patch mode** - Efficient, granular control
2. **Full document mode** - Simple, stateless

**Two packages**:
1. **`@milkdown-agent/plugin`** - Frontend Milkdown plugin
2. **`@milkdown-agent/backend-sdk`** - Backend helper for AI integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Milkdown Editor                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  User sees: Clean markdown with visual diff overlays  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Plugin tracks: Patches, version, pending changes     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ flush(syncFn)
                   SyncSnapshot / success() / failure()
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Your Backend                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Backend SDK: Parse snapshot, call AI, handle errors  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AI: Generate patches or full document                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Plugin API

### Configuration

```typescript
import { agentSuggestion } from '@milkdown-agent/plugin';

editor.use(agentSuggestion({
  changeFormat: 'aider' | 'anthropic' | 'unified-diff',
  onPatchAccepted: (patch) => {},
  onPatchRejected: (patch, reason) => {},
  onPatchesChanged: (patches) => {}
}));
```

### Core Methods

```typescript
// State extraction
getDocument(): string                          // Clean markdown
getDocumentWithPatches(): string               // With <<<>>> markers
getVersion(): number                           // Current version
getPatches<T>(): Patch<T>[]                   // All patches
serializePatches<T>(patches): T[]             // To wire format

// State application
applyPatches<T>(patches: T[]): ApplyResult    // Apply from backend

// Sync
flush(): void                                  // Simple commit
flush<T>(syncFn): Promise<FlushResult>        // Sync with backend

// Manual control
acceptPatch(id: string): void
rejectPatch(id: string): void
acceptAllPatches(): void
rejectAllPatches(): void
reset(): void
```

### Flush Signature

```typescript
type SyncFunction<T> = (
  snapshot: SyncSnapshot,
  success: (patchesOrDocument?: T[] | string, version?: number) => void,
  failure: (error: string, serverDocument?: string, serverVersion?: number) => void
) => Promise<void> | void;
```

### Types

```typescript
interface Patch<T> {
  id: string;                                  // Hash-based stable ID
  data: T;                                     // Wire format data
  operation: 'add' | 'change' | 'remove';
  source: 'instrumented' | 'inline';           // instrumented = from applyPatches()
                                               // inline = from user typing
  position: number;
  section?: string;
}

// User edits create REAL patches (source: 'inline')
// - User types → new patch created automatically
// - Shown in diff overlay like AI patches
// - Can be accepted/rejected like AI patches
// - Sent to backend in snapshot.patches
// - Backend can iterate on user's changes

interface SyncSnapshot {
  version: number;
  hasDocumentChanges: boolean;
  hasPatchChanges: boolean;
  documentWithPatches?: string;                // If hasDocumentChanges
  patches?: string[];                          // If hasPatchChanges
  acceptedPatches?: string[];
  rejectedPatches?: string[];
  newPatches?: string[];
}

interface FlushResult {
  success: boolean;
  version?: number;
  error?: string;
  serverDocument?: string;
  serverVersion?: number;
}

interface ApplyResult {
  success: boolean;
  appliedCount?: number;
  errors?: ApplyError[];
}

interface ApplyError {
  type: 'parse' | 'match' | 'invalid_markdown' | 'position' | 'conflict' | 'ambiguous';
  message: string;
  patchIndex?: number;
  patchData?: any;
  suggestions?: string[];     // For "did you mean" errors
  context?: string;           // Surrounding text for debugging
}

// See EDGE_CASES.md for detailed error handling strategies

type RejectReason = 'explicit' | 'modified' | 'deleted' | 'conflict';
```

---

## Backend SDK API

### Purpose

**Minimal helpers** for parsing patch formats and validating markdown. That's it.

### Core Functions

```typescript
import { parseDocument, serializePatches, validateMarkdown } from '@milkdown-agent/backend-sdk';

// Parse document with patches into clean doc + patches
const { document, patches } = parseDocument(
  snapshot.documentWithPatches,
  'aider' // or 'anthropic', 'unified-diff'
);

// Serialize patches back to wire format
const wireFormat = serializePatches(patches, 'aider');

// Validate markdown structure
const validation = validateMarkdown(document);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}
```

**That's it.** No session, no state, no opinions.

### LangGraph Example (You Manage State)

```typescript
import { parseDocument, serializePatches, validateMarkdown } from '@milkdown-agent/backend-sdk';
import { StateGraph } from '@langchain/langgraph';

// Your agent state
interface AgentState {
  version: number;           // YOU track this
  document: string;          // Clean document
  patches: Patch[];          // Current patches
  snapshot: SyncSnapshot;    // From client
}

// Define your graph
const graph = new StateGraph<AgentState>()
  .addNode('parse', async (state) => {
    // Use SDK to parse snapshot
    const { document, patches } = parseDocument(
      state.snapshot.documentWithPatches,
      'aider'
    );
    
    return { ...state, document, patches };
  })
  .addNode('callAI', async (state) => {
    // YOU decide what to send to AI
    const result = await llm.invoke({
      messages: [
        { role: 'system', content: 'You are a helpful editor' },
        { role: 'user', content: `Document:\n${state.document}\n\nGenerate improvements` }
      ]
    });
    
    // Parse AI response into patches
    const newPatches = parseAIResponse(result.content);
    
    return { ...state, patches: newPatches };
  })
  .addNode('validate', async (state) => {
    // Use SDK to validate
    const validation = validateMarkdown(state.document);
    if (!validation.valid) {
      throw new Error(`Invalid: ${validation.errors.join(', ')}`);
    }
    
    return state;
  })
  .addNode('respond', async (state) => {
    // Use SDK to serialize patches
    const wireFormat = serializePatches(state.patches, 'aider');
    
    // YOU increment version
    state.version++;
    
    return {
      ok: true,
      version: state.version,
      patches: wireFormat
    };
  });

// Your endpoint
app.post('/api/sync', async (req, res) => {
  const snapshot = req.body;
  
  // Load YOUR state (from DB, cache, etc.)
  const currentVersion = await db.get('version');
  
  // Version check (YOU handle this)
  if (snapshot.version !== currentVersion) {
    res.json({
      ok: false,
      error: 'Version mismatch',
      serverVersion: currentVersion,
      serverDocument: await db.get('document')
    });
    return;
  }
  
  // Run your graph
  const result = await graph.invoke({
    version: currentVersion,
    document: '',
    patches: [],
    snapshot
  });
  
  // Save YOUR state
  await db.set('version', result.version);
  await db.set('document', result.document);
  
  res.json(result);
});
```

---

## User Edit Tracking (Like Windsurf/Word Track Changes)

### How It Works

**User types** → **Plugin diffs** → **Creates patch** → **Shows in overlay**

```typescript
// ProseMirror transaction listener
editor.on('transaction', (tr) => {
  if (tr.docChanged) {
    // Diff old vs new
    const oldDoc = tr.before;
    const newDoc = tr.doc;
    const changes = diff(oldDoc, newDoc); // Using diff-match-patch
    
    // Create patch for each change
    changes.forEach(change => {
      const patch = {
        id: hash(change),
        data: formatAsPatch(change), // Convert to <<<>>> format
        operation: detectOperation(change), // 'add' | 'change' | 'remove'
        source: 'inline', // User edit
        position: change.position
      };
      
      // Add to state
      state.patches.set(patch.id, patch);
      
      // Show in diff overlay
      addDecoration(patch);
      
      // Fire callback
      onPatchesChanged(Array.from(state.patches.values()));
    });
  }
});
```

### User Experience

1. **User types "Hello world"**
   - Plugin creates patch: `{ operation: 'add', source: 'inline', data: '<<<SEARCH\n\n===\nHello world\n>>>' }`
   - Shows green overlay: "Hello world" (addition)
   - User can accept (keep) or reject (undo)

2. **User changes "Hello" to "Hi"**
   - Plugin creates patch: `{ operation: 'change', source: 'inline', data: '<<<SEARCH\nHello\n===\nHi\n>>>' }`
   - Shows yellow overlay: ~~Hello~~ → Hi
   - User can accept or reject

3. **User deletes "world"**
   - Plugin creates patch: `{ operation: 'remove', source: 'inline', data: '<<<SEARCH\nworld\n===\n\n>>>' }`
   - Shows red overlay: ~~world~~ (deletion)
   - User can accept or reject

### Benefits

- **No full doc rewrites** - Just patches, efficient
- **User can undo their own edits** - Accept/reject like AI patches
- **Backend sees all changes** - Can iterate on user edits
- **Windsurf-like UX** - Track changes mode, visual diffs
- **Consistent model** - User edits = patches, AI edits = patches

---

## User Workflows

### 1. User Accepts Patch

**Frontend**:
```typescript
acceptPatch(patchId)
→ onPatchAccepted(patch) fires
→ Patch applied to document
→ Patch removed from visual overlay
```

**Backend** (on next sync):
```typescript
snapshot.acceptedPatches = ['patchId']
→ Backend knows this patch was accepted
→ Can use as context for new patches
```

### 2. User Rejects Patch

**Frontend**:
```typescript
rejectPatch(patchId)
→ onPatchRejected(patch, 'explicit') fires
→ Patch removed from visual overlay
```

**Backend** (on next sync):
```typescript
snapshot.rejectedPatches = ['patchId']
→ Backend knows this patch was rejected
→ Can avoid similar suggestions
```

### 3. User Edits Patch Area

**Frontend**:
```typescript
User types in AI patch area
→ AI patch auto-rejected
→ onPatchRejected(aiPatch, 'modified') fires
→ User's edit becomes new REAL patch (source: 'inline')
→ New patch shown in diff overlay
→ hasPatchChanges = true
```

**Backend** (on next sync):
```typescript
snapshot.patches includes user's inline patch
snapshot.rejectedPatches includes AI patch ID
→ Backend sees user modified AI suggestion
→ Can iterate on user's version
```

### 4. User Types Anywhere

**Frontend**:
```typescript
User types anywhere in document
→ Plugin diffs old vs new content
→ Creates new REAL patch (source: 'inline')
→ Patch shown in diff overlay (like Word track changes)
→ User can accept (apply) or reject (undo) their own edit
→ hasPatchChanges = true
```

**Backend** (on next sync):
```typescript
snapshot.patches includes all patches (AI + user)
→ Backend can see what user changed
→ Can generate suggestions based on user's edits
→ NO full doc rewrite needed - just patches!
```

### 5. User Makes New Patch

**Frontend**:
```typescript
User selects text, clicks "Ask AI to improve"
→ Creates new patch with user's selection
→ Sends to backend
```

**Backend**:
```typescript
snapshot.patches includes new patch
→ AI generates improvement
→ Returns new patch
```

---

## Sync Patterns

### Pattern 1: Patch Mode

```typescript
// Frontend
await flush(async (snapshot, success, failure) => {
  const res = await fetch('/api/sync', { body: JSON.stringify(snapshot) });
  const data = await res.json();
  
  if (data.ok) {
    success(data.patches);  // Array of patches
  } else {
    failure(data.error);
  }
});

// Backend (YOU decide everything)
app.post('/api/sync', async (req, res) => {
  const snapshot = req.body;
  
  // Parse with SDK
  const { document, patches } = parseDocument(snapshot.documentWithPatches, 'aider');
  
  // Call AI (YOUR logic)
  const aiResponse = await callAI({ document, patches });
  
  // Serialize with SDK
  const newPatches = serializePatches(aiResponse.patches, 'aider');
  
  res.json({ ok: true, patches: newPatches });
});
```

### Pattern 2: Full Document Mode

```typescript
// Frontend
await flush(async (snapshot, success, failure) => {
  const res = await fetch('/api/sync', { body: snapshot.documentWithPatches });
  const newDoc = await res.text();
  
  success(newDoc);  // String (plugin detects mode)
});

// Backend (YOU decide everything)
app.post('/api/sync', async (req, res) => {
  // Parse with SDK
  const { document, patches } = parseDocument(req.body, 'aider');
  
  // Call AI (YOUR logic)
  const newDoc = await callAI({ document, patches });
  
  // Serialize with SDK
  const docWithPatches = serializeDocument(newDoc, 'aider');
  
  res.send(docWithPatches);
});
```

### Pattern 3: YOU Decide Mode

```typescript
// Backend (YOU decide patch vs full doc based on YOUR logic)
app.post('/api/sync', async (req, res) => {
  const snapshot = req.body;
  
  // Parse with SDK
  const { document, patches } = parseDocument(snapshot.documentWithPatches, 'aider');
  
  // YOUR logic to decide mode
  if (snapshot.hasDocumentChanges || patches.length > 10) {
    // Full document mode
    const newDoc = await callAI({ document, mode: 'full' });
    const docWithPatches = serializeDocument(newDoc, 'aider');
    res.json({ ok: true, document: docWithPatches });
  } else {
    // Patch mode
    const newPatches = await callAI({ document, patches, mode: 'incremental' });
    const wireFormat = serializePatches(newPatches, 'aider');
    res.json({ ok: true, patches: wireFormat });
  }
});

// Frontend (detects mode automatically)
if (data.document) {
  success(data.document);
} else {
  success(data.patches);
}
```

---

## Edge Cases & Error Handling

### Common Edge Cases (Learned from Cline/Aider/Cursor)

**1. AI returns full document instead of patches**
- Solution: Support both modes, backend decides
- Plugin detects string vs array in `success()` callback

**2. Patches extend beyond what they define**
- Solution: Fuzzy matching with `diff-match-patch`
- Progressive: exact → whitespace-insensitive → fuzzy

**3. User deletes entire document**
- Solution: Create single "remove all" patch (source: 'inline')
- User can reject to undo

**4. Search text not found (outdated context)**
- Solution: Detailed errors with suggestions
- AI can self-correct and retry

**5. Multiple similar code sections (ambiguous)**
- Solution: Validate uniqueness, require more context
- Error type: `'ambiguous'` with suggestions

**6. Conflicting patches**
- Solution: Auto-reject conflicts, notify user
- Error type: `'conflict'`

**7. Whitespace/indentation mismatches**
- Solution: Progressive fuzzy matching (like Aider)
- Try: exact → trim whitespace → ignore whitespace → fuzzy

**8. File modified since AI last saw it**
- Solution: Version checking, optional recovery
- `failure(error, serverDocument, serverVersion)`

**9. Patch would break markdown structure**
- Solution: Validate with `remark` before applying
- Error type: `'invalid_markdown'`

**10. Partial success (some patches apply, some fail)**
- Solution: Apply successful patches, report failures
- `ApplyResult` has `appliedCount` and `errors[]`

### Validation Pipeline

```typescript
function applyPatches(patches: T[]): ApplyResult {
  const errors: ApplyError[] = [];
  let appliedCount = 0;
  
  for (let i = 0; i < patches.length; i++) {
    // 1. Parse patch
    const parsed = parsePatch(patches[i]);
    if (!parsed.success) {
      errors.push({ type: 'parse', patchIndex: i, ... });
      continue;
    }
    
    // 2. Validate uniqueness (not ambiguous)
    const uniqueness = validateUniqueness(parsed, document);
    if (!uniqueness.valid) {
      errors.push({ 
        type: 'ambiguous', 
        patchIndex: i, 
        suggestions: uniqueness.matches 
      });
      continue;
    }
    
    // 3. Check conflicts with existing patches
    const conflicts = detectConflicts(parsed, existingPatches);
    if (conflicts.conflict) {
      errors.push({ type: 'conflict', patchIndex: i, ... });
      continue;
    }
    
    // 4. Validate markdown structure
    const markdown = validateMarkdown(parsed, document);
    if (!markdown.valid) {
      errors.push({ type: 'invalid_markdown', patchIndex: i, ... });
      continue;
    }
    
    // 5. Apply with fuzzy matching
    const result = applyWithFuzzyMatching(parsed, document);
    if (!result.success) {
      errors.push({ 
        type: 'match', 
        patchIndex: i, 
        suggestions: result.suggestions,
        context: result.context
      });
      continue;
    }
    
    appliedCount++;
  }
  
  return { success: errors.length === 0, appliedCount, errors };
}
```

**See `EDGE_CASES.md` for detailed examples and solutions.**

---

## Error Handling

### Frontend Auto-Reject Scenarios

1. **User modifies patch area** → `onPatchRejected(patch, 'modified')`
2. **User deletes patch area** → `onPatchRejected(patch, 'deleted')`
3. **New patch conflicts with existing** → `onPatchRejected(patch, 'conflict')`
4. **User clicks reject** → `onPatchRejected(patch, 'explicit')`

### Backend Error Recovery

```typescript
// Version mismatch
if (snapshot.version !== expectedVersion) {
  failure('Version mismatch', currentDocument, expectedVersion);
}

// AI failure with retry
const patches = await session.retry(async () => {
  return await callAI(...);
}, 3);

// Validation failure
const validation = session.validatePatches(patches);
if (!validation.valid) {
  failure(`Validation failed: ${validation.errors.join(', ')}`);
}
```

---

## Implementation Dependencies

### Frontend Plugin

**Core**:
- `@milkdown/core` - Plugin system
- `@milkdown/prose` - ProseMirror integration
- `@milkdown/ctx` - Context management

**Diff/Merge**:
- `diff-match-patch` - Text diffing (Google's library)
- `prosemirror-changeset` - Track changes in ProseMirror

**Parsing**:
- Custom parser for `<<<>>>` markers (Aider/Anthropic formats)

**UI**:
- Custom decorations for visual diff overlay
- Inline accept/reject buttons

### Backend SDK

**Just 3 functions**:
- `parseDocument(text, format)` - Parse `<<<>>>` markers → clean doc + patches
- `serializePatches(patches, format)` - Patches → wire format
- `validateMarkdown(doc)` - Check markdown is valid

**That's it.** No state, no sessions, no opinions. You handle:
- Version tracking (in your DB/cache)
- AI calling (with your agent framework)
- Retry logic (with your agent framework)
- Deciding patch vs full doc mode

---

## Plugin State Management

### Internal State

```typescript
interface PluginState {
  version: number;                    // Increments on flush
  patches: Map<string, Patch>;        // ID → Patch
  pendingChanges: {
    hasDocumentChanges: boolean;
    hasPatchChanges: boolean;
    acceptedPatches: Set<string>;
    rejectedPatches: Set<string>;
    newPatches: Set<string>;
  };
}
```

### State Transitions

```
Initial State (version: 1, patches: [])
  ↓
applyPatches([p1, p2])
  → patches: [p1, p2]
  → pendingChanges.newPatches: [p1.id, p2.id]
  → version: 1 (unchanged)
  ↓
acceptPatch(p1.id)
  → patches: [p2]
  → pendingChanges.acceptedPatches: [p1.id]
  → version: 1 (unchanged)
  ↓
User edits document
  → patches: [p2, p3_inline]
  → pendingChanges.hasDocumentChanges: true
  → version: 1 (unchanged)
  ↓
flush(syncFn)
  → Calls syncFn with snapshot
  → On success(): version: 2, pendingChanges cleared
  → On failure(): version: 1, pendingChanges preserved
```

---

## Wire Formats

### Aider Format (Default)

```
<<<SEARCH
old text
===
new text
>>>
```

### Anthropic Format

```
<<<<<<< SEARCH
old text
=======
new text
>>>>>>> REPLACE
```

### Unified Diff Format

```
--- a/document.md
+++ b/document.md
@@ -1,3 +1,3 @@
 # Title
-old text
+new text
 More content
```

---

## Monorepo Structure

```
milkdown-agent/
├── packages/
│   ├── core/                    # Shared code
│   │   ├── parsers/            # Format parsers (Aider, Anthropic, Unified)
│   │   ├── validators/         # Markdown validation
│   │   └── types/              # Shared types
│   ├── plugin/                  # Frontend plugin
│   │   ├── plugin.ts           # Main plugin
│   │   ├── state.ts            # State management
│   │   ├── decorations.ts      # Visual diff overlay
│   │   └── commands.ts         # Milkdown commands
│   └── backend-sdk/             # Backend SDK (minimal!)
│       └── index.ts            # Just 3 functions: parse, serialize, validate
├── examples/
│   ├── react-demo/             # Frontend demo
│   ├── node-backend/           # Backend demo (Express)
│   └── langgraph-backend/      # Backend demo (LangGraph)
└── package.json
```

---

## Implementation Checklist

### Phase 1: Core Plugin
- [ ] Plugin state management
- [ ] Patch tracking (hash-based IDs)
- [ ] User edit tracking (diff on every transaction → create inline patches)
- [ ] Visual diff decorations (for both AI and user patches)
- [ ] Accept/reject commands
- [ ] Flush command with callbacks
- [ ] Format parsers (Aider, Anthropic, Unified)

### Phase 2: User Interactions
- [ ] Inline accept/reject buttons
- [ ] Auto-reject on user edit
- [ ] Conflict detection
- [ ] Keyboard shortcuts
- [ ] Slash commands

### Phase 3: Backend SDK
- [ ] parseDocument() - Parse `<<<>>>` markers
- [ ] serializePatches() - Serialize to wire format
- [ ] validateMarkdown() - Validate markdown structure

### Phase 4: Integration
- [ ] React demo app
- [ ] Node.js backend example
- [ ] Python backend example
- [ ] Documentation
- [ ] Tests

---

## Success Criteria

**Windsurf-like Experience**:
- ✅ Visual diff overlay showing all changes (AI + user)
- ✅ Inline accept/reject on each patch
- ✅ **User edits auto-tracked as real patches** (like Word track changes)
- ✅ User can accept/reject their own edits
- ✅ User can edit AI patches (creates new inline patch)
- ✅ Clean markdown view (no markers visible to user)
- ✅ Both AI and user patches use same model (just different `source`)

**Flexible Backend**:
- ✅ Works with any language (Python, Go, etc.)
- ✅ Supports patch mode (efficient, no full doc rewrites)
- ✅ Supports full doc mode (simple, stateless)
- ✅ Backend sees all patches (AI + user) in snapshot
- ✅ Backend can iterate on user's changes
- ✅ Version conflict recovery

**Developer Experience**:
- ✅ Simple API (flush with callbacks)
- ✅ Minimal Backend SDK (just 3 parsing functions)
- ✅ Clear error messages
- ✅ TypeScript types
- ✅ Good documentation
- ✅ Working examples (React + LangGraph)
