# Change Grouping: Debouncing + Semantic Cleanup

## Problem

Creating a patch for every single character typed is inefficient and creates too many patches:
- Typing "hello" would create 5 patches (h, he, hel, hell, hello)
- User sees overwhelming number of patches
- Poor UX - too granular

## Solution

**Two-phase approach**: Debouncing (WHEN) + Semantic Cleanup (WHERE)

### Phase 1: Debouncing (Temporal)
Wait until user stops typing before processing changes.

### Phase 2: Semantic Cleanup (Structural)
Use Google's diff-match-patch algorithm to group changes based on document structure.

### How It Works

1. **User types** → Accumulate changes (baseline → latest)
2. **User stops for 1 second** → Trigger processing
3. **Compute diff** → Myers' algorithm on baseline vs latest
4. **Semantic cleanup** → Merge small equalities surrounded by changes
5. **Efficiency cleanup** → Combine nearby edits
6. **Reconcile patches** → Deduplicate and merge overlapping
7. **Result**: Minimal, meaningful patches

**Key insight**: Debounce controls WHEN we process, semantic cleanup controls HOW we group!

### Example

```
User types: "hello world"

Without debouncing:
- Patch 1: "" → "h"
- Patch 2: "h" → "he"
- Patch 3: "he" → "hel"
- Patch 4: "hel" → "hell"
- Patch 5: "hell" → "hello"
- Patch 6: "hello" → "hello "
- Patch 7: "hello " → "hello w"
... (11 patches total!)

With debouncing (1 second delay):
- Patch 1: "" → "hello world"
(1 patch total!)
```

### Implementation

```typescript
// Debounce settings
const DEBOUNCE_DELAY = 1000; // Wait 1 second after last edit

// Module-level state
let debounceTimer: NodeJS.Timeout | null = null;
let pendingOldDoc: string | null = null;  // Initial state
let pendingNewDoc: string | null = null;   // Final state
let pendingCallback: ((patches: Patch[]) => void) | null = null;

export function trackUserEdits(
  tr: Transaction,
  oldDoc: string,
  newDoc: string,
  onPatchesReady: (patches: Patch[]) => void
): void {
  if (!tr.docChanged) return;
  
  // Store initial state on first edit
  if (pendingOldDoc === null) {
    pendingOldDoc = oldDoc;
  }
  
  // Always update to latest state
  pendingNewDoc = newDoc;
  pendingCallback = onPatchesReady;
  
  // Reset timer on each edit
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Create patches after user stops typing
  debounceTimer = setTimeout(() => {
    if (pendingOldDoc && pendingNewDoc && pendingCallback) {
      const changes = detectChanges(pendingOldDoc, pendingNewDoc);
      const patches = changes.map(change => changeToPatch(change, pendingOldDoc!));
      
      if (patches.length > 0) {
        pendingCallback(patches);
      }
      
      // Reset
      pendingOldDoc = null;
      pendingNewDoc = null;
      pendingCallback = null;
    }
    debounceTimer = null;
  }, DEBOUNCE_DELAY);
}
```

### Benefits

1. **Fewer patches** - One patch per edit session instead of per character
2. **Better UX** - User sees meaningful changes, not character-by-character
3. **More efficient** - Less processing, less memory
4. **Semantic grouping** - Patches represent complete thoughts/edits

### Flush Pending Edits

Force immediate patch creation (e.g., before sync):

```typescript
export function flushPendingEdits(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    // Create patches immediately
    // ...
  }
}
```

### Tuning

Adjust `DEBOUNCE_DELAY` based on use case:
- **500ms** - More responsive, more patches
- **1000ms** - Balanced (default)
- **2000ms** - Fewer patches, less responsive

## Comparison to Other Tools

### Cline/Cursor
- Use similar debouncing for file edits
- Typically 1-2 second delays
- Group related changes together

### Google Docs
- Uses operational transformation with debouncing
- ~200-500ms delays for collaborative editing
- Different use case (real-time collaboration)

### Our Approach
- 1 second delay (good for code/markdown editing)
- Groups continuous typing sessions
- Creates patches only for non-continuous edits
- Balances responsiveness with granularity

## Future Improvements

1. **Smart grouping** - Detect semantic boundaries (sentences, paragraphs)
2. **Adaptive delay** - Shorter for small edits, longer for large
3. **User preference** - Configurable delay in settings
4. **Flush on blur** - Create patches when user leaves editor
