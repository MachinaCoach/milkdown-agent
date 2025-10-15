# Milkdown Agent Plugin: Implementation Guide

**Start here to implement the plugin.** This document references all the core specs with specific line numbers.

---

## Core Documents

1. **IMPLEMENTATION_SPEC.md** - Complete technical specification
2. **EDGE_CASES.md** - Error handling and edge cases
3. **BACKEND_SDK_SUMMARY.md** - Backend SDK explanation
4. **PLUGIN_CONTRACT_V6.md** - Detailed API contract
5. **IMPLEMENTATION_SUMMARY.md** - Quick overview

---

## What We're Building

A Milkdown plugin for AI-assisted editing with:
- **Windsurf-like UX** - Visual diff overlay, inline accept/reject
- **User edit tracking** - User types → creates real patches (like Word track changes)
- **Flexible sync** - Patch mode (efficient) or full doc mode (simple)
- **Minimal backend SDK** - Just 3 parsing functions

---

## Phase 1: Core Plugin

### 1.1 Plugin State Management

**Reference**: `IMPLEMENTATION_SPEC.md` lines 518-560

**Implement**:
```typescript
interface PluginState {
  version: number;
  patches: Map<string, Patch>;
  pendingChanges: {
    hasDocumentChanges: boolean;
    hasPatchChanges: boolean;
    acceptedPatches: Set<string>;
    rejectedPatches: Set<string>;
    newPatches: Set<string>;
  };
}
```

**State transitions**: Lines 541-560 show how state changes on each action.

### 1.2 Patch Tracking with Hash-Based IDs

**Reference**: `IMPLEMENTATION_SPEC.md` lines 98-113

**Implement**:
```typescript
interface Patch<T> {
  id: string;                    // Hash-based stable ID
  data: T;                       // Wire format data
  operation: 'add' | 'change' | 'remove';
  source: 'instrumented' | 'inline';  // AI or user edit
  position: number;
  section?: string;
}
```

**Key**: Use hash of patch content for stable IDs (no server coordination needed).

### 1.3 User Edit Tracking (CRITICAL)

**Reference**: `IMPLEMENTATION_SPEC.md` lines 279-340

**Implement ProseMirror transaction listener**:
```typescript
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
        data: formatAsPatch(change),
        operation: detectOperation(change),
        source: 'inline', // User edit
        position: change.position
      };
      
      state.patches.set(patch.id, patch);
      addDecoration(patch);
      onPatchesChanged(Array.from(state.patches.values()));
    });
  }
});
```

**Dependencies**: 
- `diff-match-patch` for diffing (lines 489-491)
- `prosemirror-changeset` for tracking changes (lines 492)

### 1.4 Visual Diff Decorations

**Reference**: `IMPLEMENTATION_SPEC.md` lines 317-332

**Implement decorations for**:
- Green overlay for additions
- Yellow overlay for changes
- Red overlay for deletions
- Same treatment for AI and user patches

**Example**: Lines 319-332 show user experience.

### 1.5 Accept/Reject Commands

**Reference**: `IMPLEMENTATION_SPEC.md` lines 76-82

**Implement**:
```typescript
acceptPatch(id: string): void
rejectPatch(id: string): void
acceptAllPatches(): void
rejectAllPatches(): void
```

**Behavior**: Lines 346-371 show what happens on accept/reject.

### 1.6 Flush Command with Callbacks

**Reference**: `PLUGIN_CONTRACT_V6.md` lines 85-92

**Implement**:
```typescript
type SyncFunction<T> = (
  snapshot: SyncSnapshot,
  success: (patchesOrDocument?: T[] | string, version?: number) => void,
  failure: (error: string, serverDocument?: string, serverVersion?: number) => void
) => Promise<void> | void;

flush<T>(syncFn: SyncFunction<T>): Promise<FlushResult>
```

**Success callback**: `PLUGIN_CONTRACT_V6.md` lines 281-308
**Failure callback**: `PLUGIN_CONTRACT_V6.md` lines 310-327

**Atomic behavior**: Version increments only if `success()` called (lines 227-244).

### 1.7 Format Parsers

**Reference**: `IMPLEMENTATION_SPEC.md` lines 616-648

**Implement parsers for**:
- Aider format: `<<<SEARCH\n...\n===\n...\n>>>`
- Anthropic format: `<<<<<<< SEARCH\n...\n=======\n...\n>>>>>>> REPLACE`
- Unified diff format

**Share with backend SDK** via monorepo core package (lines 657-660).

---

## Phase 2: User Interactions

### 2.1 Inline Accept/Reject Buttons

**Reference**: `IMPLEMENTATION_SPEC.md` lines 715-720

Add buttons to each patch decoration:
- Accept button → calls `acceptPatch(id)`
- Reject button → calls `rejectPatch(id)`

### 2.2 Auto-Reject on User Edit

**Reference**: `IMPLEMENTATION_SPEC.md` lines 314-332

When user types in AI patch area:
1. Auto-reject AI patch
2. Fire `onPatchRejected(aiPatch, 'modified')`
3. Create new inline patch from user's edit

### 2.3 Conflict Detection

**Reference**: `EDGE_CASES.md` lines 180-213

**Implement**:
```typescript
function detectConflicts(newPatch, existingPatches) {
  for (const existing of existingPatches) {
    if (rangesOverlap(newPatch.position, existing.position)) {
      return { conflict: true, conflictsWith: existing.id };
    }
  }
  return { conflict: false };
}
```

Auto-reject conflicting patches.

### 2.4 Keyboard Shortcuts

Add shortcuts for:
- Accept patch: `Cmd+Shift+A`
- Reject patch: `Cmd+Shift+R`
- Accept all: `Cmd+Shift+Option+A`

### 2.5 Slash Commands

Add `/sync` command to trigger flush.

---

## Phase 3: Backend SDK

### 3.1 parseDocument()

**Reference**: `BACKEND_SDK_SUMMARY.md` lines 16-22

**Implement**:
```typescript
function parseDocument(
  textWithPatches: string,
  format: 'aider' | 'anthropic' | 'unified-diff'
): { document: string; patches: Patch[] }
```

Parse `<<<>>>` markers → clean document + patches.

### 3.2 serializePatches()

**Reference**: `BACKEND_SDK_SUMMARY.md` lines 24-31

**Implement**:
```typescript
function serializePatches(
  patches: Patch[],
  format: 'aider' | 'anthropic' | 'unified-diff'
): string
```

Patches → text with `<<<>>>` markers.

### 3.3 validateMarkdown()

**Reference**: `BACKEND_SDK_SUMMARY.md` lines 33-42

**Implement**:
```typescript
function validateMarkdown(document: string): ValidationResult
```

Use `remark` to validate markdown structure.

**Dependencies**: `remark` for parsing (lines 443-445).

---

## Phase 4: Error Handling & Edge Cases

### 4.1 Validation Pipeline

**Reference**: `IMPLEMENTATION_SPEC.md` lines 579-636

**Implement 5-step validation**:
1. Parse patch
2. Validate uniqueness (not ambiguous)
3. Check conflicts
4. Validate markdown structure
5. Apply with fuzzy matching

**Return**: `ApplyResult` with `success`, `appliedCount`, `errors[]`.

### 4.2 Progressive Fuzzy Matching

**Reference**: `EDGE_CASES.md` lines 215-236

**Implement**:
```typescript
function applyPatchWithFuzzyMatching(patch, document) {
  // 1. Try exact match
  let result = exactMatch(patch.search, document);
  if (result.found) return applyReplace(result, patch.replace);
  
  // 2. Try ignoring trailing whitespace
  result = matchIgnoringTrailingWhitespace(patch.search, document);
  if (result.found) return applyReplace(result, patch.replace);
  
  // 3. Try ignoring all whitespace
  result = matchIgnoringWhitespace(patch.search, document);
  if (result.found) return applyReplace(result, patch.replace);
  
  // 4. Try fuzzy match with difflib
  result = fuzzyMatch(patch.search, document);
  if (result.score > 0.8) return applyReplace(result, patch.replace);
  
  return { success: false, error: 'No match found' };
}
```

### 4.3 Detailed Error Messages

**Reference**: `EDGE_CASES.md` lines 121-154

**Implement errors with**:
- Error type: `'parse' | 'match' | 'invalid_markdown' | 'position' | 'conflict' | 'ambiguous'`
- Suggestions: "Did you mean..." hints
- Context: Surrounding text for debugging

**Example**: Lines 121-154 show Aider-style detailed errors.

### 4.4 Handle All 10 Edge Cases

**Reference**: `EDGE_CASES.md` lines 8-298

**Implement solutions for**:
1. AI returns full document (lines 8-48)
2. Patches extend beyond definition (lines 50-89)
3. User deletes entire doc (lines 91-119)
4. Search text not found (lines 121-154)
5. Multiple similar sections (lines 156-178)
6. Conflicting patches (lines 180-213)
7. Whitespace mismatches (lines 215-236)
8. File modified (stale) (lines 238-270)
9. Would break markdown (lines 272-296)
10. Partial success (lines 298-341)

---

## Phase 5: Integration Examples

### 5.1 React Demo App

**Reference**: `IMPLEMENTATION_SPEC.md` lines 668-671

Create React app showing:
- Milkdown editor with plugin
- Visual diff overlay
- Accept/reject buttons
- Sync with backend

### 5.2 LangGraph Backend Example

**Reference**: `IMPLEMENTATION_SPEC.md` lines 175-267

**Implement**:
```typescript
interface AgentState {
  version: number;      // YOU track this
  document: string;
  patches: Patch[];
  snapshot: SyncSnapshot;
}

const graph = new StateGraph<AgentState>()
  .addNode('parse', (state) => {
    const { document, patches } = parseDocument(
      state.snapshot.documentWithPatches,
      'aider'
    );
    return { ...state, document, patches };
  })
  .addNode('callAI', async (state) => {
    const result = await llm.invoke({...});
    return { ...state, patches: parseAIResponse(result) };
  })
  .addNode('validate', (state) => {
    const validation = validateMarkdown(state.document);
    if (!validation.valid) throw new Error(...);
    return state;
  })
  .addNode('respond', (state) => {
    const wireFormat = serializePatches(state.patches, 'aider');
    state.version++;
    return { ok: true, version: state.version, patches: wireFormat };
  });
```

### 5.3 Express Backend Example

**Reference**: `IMPLEMENTATION_SPEC.md` lines 375-389

Simple Express server showing:
- Parse snapshot with SDK
- Call AI
- Serialize response
- Version checking

---

## Monorepo Structure

**Reference**: `IMPLEMENTATION_SPEC.md` lines 652-673

```
milkdown-agent/
├── packages/
│   ├── core/                    # Shared parsers, validators, types
│   ├── plugin/                  # Frontend Milkdown plugin
│   └── backend-sdk/             # Backend SDK (3 functions)
├── examples/
│   ├── react-demo/
│   ├── node-backend/
│   └── langgraph-backend/
└── package.json
```

---

## Dependencies

### Frontend Plugin

**Reference**: `IMPLEMENTATION_SPEC.md` lines 482-502

- `@milkdown/core` - Plugin system
- `@milkdown/prose` - ProseMirror integration
- `diff-match-patch` - Text diffing
- `prosemirror-changeset` - Track changes

### Backend SDK

**Reference**: `IMPLEMENTATION_SPEC.md` lines 504-514

- Shared parsers from core package
- `remark` - Markdown validation
- No AI calling, no retry logic, no state management

---

## Success Criteria

**Reference**: `IMPLEMENTATION_SPEC.md` lines 736-761

**Must have**:
- ✅ Visual diff overlay (AI + user changes)
- ✅ Inline accept/reject on each patch
- ✅ User edits auto-tracked as real patches
- ✅ User can accept/reject their own edits
- ✅ Works with any backend language
- ✅ Patch mode (efficient) + full doc mode (simple)
- ✅ Backend sees all patches (AI + user)
- ✅ All 10 edge cases handled

---

## Quick Start for LLM Implementation

1. **Read**: `IMPLEMENTATION_SPEC.md` (full spec)
2. **Understand edge cases**: `EDGE_CASES.md`
3. **Check API**: `PLUGIN_CONTRACT_V6.md`
4. **Start with Phase 1**: Implement core plugin (this doc, Phase 1 section)
5. **Test each phase**: Don't move to next phase until current works
6. **Reference line numbers**: All line numbers in this doc point to exact implementation details

---

## Key Design Principles

1. **User edits = Real patches** (not just visual)
2. **Minimal backend SDK** (just 3 functions)
3. **Callback-based flush** (atomic operations)
4. **Progressive fuzzy matching** (handle AI imperfections)
5. **Detailed errors** (AI can self-correct)
6. **Partial success** (some patches can fail)

---

## Next Steps

1. Set up monorepo structure
2. Implement Phase 1: Core Plugin
3. Implement Phase 2: User Interactions
4. Implement Phase 3: Backend SDK
5. Implement Phase 4: Error Handling
6. Create examples (React + LangGraph)
7. Write tests
8. Document

**All implementation details are in the referenced documents with specific line numbers.**
