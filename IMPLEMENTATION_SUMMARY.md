# Implementation Summary

## What We're Building

A **Milkdown plugin** for AI-assisted editing with **Windsurf-like UX** and a **minimal backend SDK**.

---

## Core Features

### 1. User Edit Tracking (Like Windsurf/Word Track Changes)

**User types** → **Plugin diffs** → **Creates real patch** → **Shows in overlay**

- User edits create REAL patches (not just visual)
- Same `Patch<T>` interface as AI patches
- User can accept/reject their own edits
- All patches sent to backend (AI + user)

### 2. Two Sync Modes

**Patch Mode** (efficient):
```typescript
success(patches); // Array of patches
```

**Full Document Mode** (simple):
```typescript
success(documentString); // Full document
```

Plugin auto-detects based on type.

### 3. Callback-Based Flush

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    success(data.patches); // or data.document
  } else {
    failure(data.error, data.serverDocument, data.serverVersion);
  }
});
```

**Atomic**: Version increments only if `success()` called.

### 4. Minimal Backend SDK

**Just 3 functions**:
```typescript
parseDocument(text, format)    // Parse <<<>>> → clean doc + patches
serializePatches(patches, format)  // Patches → <<<>>>
validateMarkdown(doc)          // Check markdown valid
```

**You handle**: Version tracking, AI calling, retry logic, state management.

---

## Edge Cases Handled

Based on research of Cline, Aider, Cursor:

1. ✅ **AI returns full document** → Support both modes
2. ✅ **Patches extend beyond definition** → Fuzzy matching
3. ✅ **User deletes entire doc** → Single "remove all" patch
4. ✅ **Search text not found** → Detailed errors with suggestions
5. ✅ **Multiple similar sections** → Validate uniqueness
6. ✅ **Conflicting patches** → Auto-reject, notify
7. ✅ **Whitespace mismatches** → Progressive fuzzy matching
8. ✅ **File modified (stale)** → Version checking + recovery
9. ✅ **Would break markdown** → Validate before applying
10. ✅ **Partial success** → Apply successful, report failures

**Key strategy**: Progressive fuzzy matching (exact → whitespace → fuzzy)

---

## Validation Pipeline

```typescript
applyPatches(patches) {
  for each patch:
    1. Parse → error if malformed
    2. Validate uniqueness → error if ambiguous
    3. Check conflicts → auto-reject if conflicts
    4. Validate markdown → error if would break structure
    5. Apply with fuzzy matching → error if no match
    
  return { success, appliedCount, errors[] }
}
```

**Partial success**: Some patches can succeed while others fail.

---

## API Summary

### Frontend Plugin

**Methods** (13 total):
```typescript
// State extraction
getDocument(): string
getDocumentWithPatches(): string
getVersion(): number
getPatches<T>(): Patch<T>[]
serializePatches<T>(patches): T[]

// State application
applyPatches<T>(patches): ApplyResult
flush(): void
flush<T>(syncFn): Promise<FlushResult>
reset(): void

// Manual control
acceptPatch(id): void
rejectPatch(id): void
acceptAllPatches(): void
rejectAllPatches(): void
```

**Callbacks** (3 total):
```typescript
onPatchAccepted(patch)
onPatchRejected(patch, reason)
onPatchesChanged(patches)
```

### Backend SDK

**Functions** (3 total):
```typescript
parseDocument(text, format)
serializePatches(patches, format)
validateMarkdown(doc)
```

---

## Key Design Decisions

### 1. User Edits = Real Patches

Not just visual overlays. User types → creates patch with `source: 'inline'`.

**Benefits**:
- Consistent model (AI and user patches are the same)
- No full doc rewrites needed
- Backend can iterate on user's changes
- User can undo their own edits

### 2. Minimal Backend SDK

No sessions, no state, no AI calling, no retry logic.

**Benefits**:
- Works with any agent framework (LangGraph, LangChain, etc.)
- You control version tracking
- You control AI calling
- Unopinionated

### 3. Callback-Based Flush

`success()` and `failure()` callbacks instead of return objects.

**Benefits**:
- Clearer intent
- Flexible parameters (all optional)
- No return boilerplate
- Atomic operations

### 4. Progressive Fuzzy Matching

Try multiple strategies: exact → whitespace → fuzzy.

**Benefits**:
- Handles AI imperfections
- Handles whitespace differences
- Like Aider/Cursor

### 5. Detailed Error Messages

Errors include suggestions, context, and "did you mean" hints.

**Benefits**:
- AI can self-correct
- Faster iteration
- Better UX

---

## Implementation Phases

### Phase 1: Core Plugin
- Plugin state management
- Patch tracking (hash-based IDs)
- **User edit tracking** (diff on every transaction)
- Visual diff decorations
- Accept/reject commands
- Flush command with callbacks
- Format parsers (Aider, Anthropic, Unified)

### Phase 2: User Interactions
- Inline accept/reject buttons
- Auto-reject on user edit
- Conflict detection
- Keyboard shortcuts
- Slash commands

### Phase 3: Backend SDK
- parseDocument()
- serializePatches()
- validateMarkdown()

### Phase 4: Integration
- React demo app
- Node.js backend example (Express)
- LangGraph backend example
- Documentation
- Tests

---

## Success Criteria

**Windsurf-like Experience**:
- ✅ Visual diff overlay (AI + user changes)
- ✅ Inline accept/reject on each patch
- ✅ **User edits auto-tracked as real patches**
- ✅ User can accept/reject their own edits
- ✅ Clean markdown view (no markers visible)

**Flexible Backend**:
- ✅ Works with any language
- ✅ Patch mode (efficient) + full doc mode (simple)
- ✅ Backend sees all patches (AI + user)
- ✅ Version conflict recovery

**Developer Experience**:
- ✅ Simple API (flush with callbacks)
- ✅ Minimal SDK (3 functions)
- ✅ Clear error messages
- ✅ TypeScript types
- ✅ Working examples

---

## Files

- **IMPLEMENTATION_SPEC.md** - Full technical spec
- **EDGE_CASES.md** - Detailed edge case handling
- **BACKEND_SDK_SUMMARY.md** - Backend SDK explanation
- **PLUGIN_CONTRACT_V6.md** - Plugin API contract
- **V6_CALLBACK_API.md** - Callback API design

---

## Ready to Implement!

The spec is complete, lean, and handles all common edge cases from production AI coding assistants.
