# Change Tracking Algorithm - Step by Step

## Research & Sources

### 1. Operational Transformation (OT)
**Source**: [Wikipedia - Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)

**Key Concept**: Transform concurrent operations so they can be applied in any order while maintaining consistency.

**Example from Wikipedia**:
```
Document: "abc"
O1 = Insert[0, "x"]  → "xabc"
O2 = Delete[2, "c"]  → must transform to Delete[3, "c"] after O1
```

**Invented**: 1989 by C. Ellis and S. Gibbs in GROVE system

### 2. ProseMirror Collaborative Editing
**Source**: [ProseMirror Collab Guide](https://github.com/ProseMirror/website/blob/master/markdown/guide/collab.md)

**Architecture**:
- Central authority tracks document version
- Clients send Steps (not raw text!)
- Authority accepts/rejects based on version
- Clients rebase rejected changes

**Key Quote**:
> "ProseMirror's collaborative editing system employs a central authority which determines in which order changes are applied."

### 3. ProseMirror Steps
**Source**: [ProseMirror Track Changes Example](https://prosemirror.net/examples/track/)

**Key Concept**: Steps contain exact position information via StepMap

```javascript
step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
  // Exact positions of what changed!
})
```

## Our Algorithm (Based on Research)

### Phase 1: Capture Changes (ProseMirror Steps)

**What**: Extract position-based changes from ProseMirror transactions

**How**: Use `step.getMap()` to get exact positions

**Why**: ProseMirror already computed the diff for us!

```typescript
// From ProseMirror transaction
for (const step of tr.steps) {
  const stepMap = step.getMap();
  
  stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
    // We have EXACT positions - no string diffing needed!
    const change = {
      from: newStart,
      to: newEnd,
      oldText: beforeDoc.textBetween(oldStart, oldEnd),
      newText: afterDoc.textBetween(newStart, newEnd)
    };
  });
}
```

**References**:
- ProseMirror Transform API
- Similar to how `prosemirror-collab` tracks steps

### Phase 2: Group Changes (Position-Based)

**What**: Merge adjacent changes at same position

**How**: Track active changes by position, merge on collision

**Why**: Like Word's track changes - edits at same spot merge

```typescript
// Position-based tracking (like Word)
const changesByPosition = new Map<number, Change>();

if (changesByPosition.has(position)) {
  // Merge with existing change at this position
  const existing = changesByPosition.get(position);
  const merged = mergeChanges(existing, newChange);
  changesByPosition.set(position, merged);
} else {
  // New change at this position
  changesByPosition.set(position, newChange);
}
```

**References**:
- Microsoft Word Track Changes (position-based merging)
- Google Docs suggestions (similar approach)

### Phase 3: Convert to Patches (Aider Format)

**What**: Convert position-based changes to search/replace patches

**How**: Extract text at positions, format as `<<<SEARCH\n...\n===\n...\n>>>`

**Why**: Backend-agnostic wire format

```typescript
function changeToPatch(change: Change): Patch {
  const search = change.oldText;
  const replace = change.newText;
  
  return {
    id: hash(search + replace),
    data: `<<<SEARCH\n${search}\n===\n${replace}\n>>>`,
    operation: detectOperation(search, replace),
    position: change.from,
    source: 'inline'
  };
}
```

**References**:
- Aider format specification
- Similar to unified diff format

### Phase 4: Reconcile Conflicts

**What**: Handle overlapping changes

**How**: Check for position overlaps, merge or reject

**Why**: Prevent conflicting patches

```typescript
function reconcilePatches(patches: Patch[]): Patch[] {
  const reconciled: Patch[] = [];
  
  for (const patch of patches) {
    const overlapping = findOverlapping(patch, reconciled);
    
    if (overlapping) {
      // Merge or reject based on policy
      const merged = mergeOrReject(patch, overlapping);
      if (merged) reconciled.push(merged);
    } else {
      reconciled.push(patch);
    }
  }
  
  return reconciled;
}
```

**References**:
- OT conflict resolution
- ProseMirror rebasing

## Complete Algorithm Flow

```
User types "h"
  ↓
ProseMirror creates Step
  ↓
Step.getMap() → (oldStart: 0, oldEnd: 0, newStart: 0, newEnd: 1)
  ↓
Extract change: { from: 0, to: 1, oldText: "", newText: "h" }
  ↓
Check changesByPosition[0] → none exists
  ↓
Create new change at position 0
  ↓
Convert to patch: <<<SEARCH\n\n===\nh\n>>>
  ↓
Return patch immediately

User types "e"
  ↓
Step.getMap() → (oldStart: 1, oldEnd: 1, newStart: 1, newEnd: 2)
  ↓
Extract change: { from: 1, to: 2, oldText: "", newText: "e" }
  ↓
Check changesByPosition[1] → none exists
  ↓
Create new change at position 1
  ↓
Convert to patch
  ↓
Return patch immediately

User edits position 0 again (changes "h" to "H")
  ↓
Step.getMap() → (oldStart: 0, oldEnd: 1, newStart: 0, newEnd: 1)
  ↓
Extract change: { from: 0, to: 1, oldText: "h", newText: "H" }
  ↓
Check changesByPosition[0] → EXISTS!
  ↓
Merge: keep original oldText (""), update newText to "H"
  ↓
Merged patch: <<<SEARCH\n\n===\nH\n>>>
  ↓
Return merged patch
```

## Key Differences from Naive Approaches

### ❌ Don't Do This:
- String diffing on every keystroke (slow, inaccurate)
- Debounce timers (not how real systems work)
- Character-by-character patches (too granular)

### ✅ Do This:
- Use ProseMirror Steps (already computed!)
- Position-based tracking (exact, efficient)
- Merge at same position (like Word)
- Immediate computation (no timers)

## References

1. **Operational Transformation**
   - Ellis & Gibbs, 1989, GROVE system
   - https://en.wikipedia.org/wiki/Operational_transformation

2. **ProseMirror Collaboration**
   - https://prosemirror.net/docs/guide/#collab
   - https://github.com/ProseMirror/prosemirror-collab

3. **ProseMirror Track Changes**
   - https://prosemirror.net/examples/track/

4. **Microsoft Word Track Changes**
   - Position-based change tracking
   - Merge edits at same location

5. **Google Docs**
   - Operational Transformation
   - Real-time collaboration

## Implementation Checklist

- [ ] Extract changes from ProseMirror Steps
- [ ] Track changes by position (Map<position, Change>)
- [ ] Merge changes at same position
- [ ] Convert to Aider format patches
- [ ] Reconcile overlapping patches
- [ ] Return immediately (no timers)
- [ ] Handle accept/reject
- [ ] Update positions on document changes (OT)
