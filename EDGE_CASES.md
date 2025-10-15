# Edge Cases & Error Handling

## Common Edge Cases (From Cline, Aider, Cursor Research)

### 1. AI Returns Full Document Instead of Patches

**Problem**: AI writes entire document instead of targeted patches

**Solutions**:

**Option A: Parse as full document replacement**
```typescript
// Backend detects this
if (aiResponse.length > document.length * 0.8) {
  // AI returned nearly full document, treat as replacement
  success(aiResponse); // Full doc mode
} else {
  // Parse as patches
  const patches = parseDocument(aiResponse, 'aider');
  success(patches.patches);
}
```

**Option B: Reject and ask AI to retry**
```typescript
const validation = validatePatches(aiResponse);
if (validation.type === 'full_document_detected') {
  // Ask AI to retry with patches only
  const retry = await callAI({
    messages: [
      ...previousMessages,
      { role: 'assistant', content: aiResponse },
      { role: 'user', content: 'Please provide only the SEARCH/REPLACE blocks for the changes, not the full document.' }
    ]
  });
  return retry;
}
```

**Our approach**: Support both modes, let backend decide

### 2. Patches Extend Beyond What They Define

**Problem**: AI says "change line 5" but the change affects lines 5-10

**Example**:
```
<<<SEARCH
function foo() {
===
function foo(arg1, arg2) {
>>>
```
But this breaks the closing brace on line 10.

**Solutions**:

**Fuzzy matching with context**:
```typescript
// Use diff-match-patch with context
const dmp = new DiffMatchPatch();
const patches = dmp.patch_make(oldText, newText);

// Apply with fuzzy matching
const [newText, results] = dmp.patch_apply(patches, document);

// Check if all patches applied
if (results.every(r => r)) {
  success(newText);
} else {
  // Some patches failed
  failure('Patch application failed', results);
}
```

**Validation before applying**:
```typescript
function validatePatch(patch, document) {
  // Check if SEARCH text exists
  if (!document.includes(patch.search)) {
    return { valid: false, error: 'Search text not found' };
  }
  
  // Check if replacement would break syntax
  const testDoc = document.replace(patch.search, patch.replace);
  const syntaxCheck = validateMarkdown(testDoc);
  
  if (!syntaxCheck.valid) {
    return { valid: false, error: 'Would break markdown structure' };
  }
  
  return { valid: true };
}
```

**Our approach**: Validate before applying, provide detailed errors

### 3. User Deletes Entire Document

**Problem**: User selects all and deletes

**Solutions**:

**Create single "remove all" patch**:
```typescript
// Detect full deletion
if (newDoc.length === 0 && oldDoc.length > 0) {
  const patch = {
    id: hash('delete_all'),
    operation: 'remove',
    source: 'inline',
    data: `<<<SEARCH\n${oldDoc}\n===\n\n>>>`,
    position: 0
  };
  
  state.patches.set(patch.id, patch);
}
```

**User can reject to undo**:
```typescript
rejectPatch('delete_all')
→ Document restored
```

**Our approach**: Single patch for full deletion, can be undone

### 4. Search Text Not Found (Outdated Context)

**Problem**: AI's view of file is outdated, SEARCH text doesn't exist

**Solutions**:

**Detailed error with suggestions**:
```typescript
const result = applyPatch(patch, document);

if (result.error === 'search_not_found') {
  // Find similar text
  const similar = findSimilarText(patch.search, document);
  
  failure(
    `Search text not found in document`,
    undefined, // No recovery doc
    undefined  // No version
  );
  
  // Return detailed error to AI
  return {
    error: 'SearchNotFound',
    searchText: patch.search,
    suggestions: similar.map(s => ({
      text: s.text,
      position: s.position,
      similarity: s.score
    }))
  };
}
```

**AI can retry with corrected search**:
```typescript
// AI sees error and retries
const retry = await callAI({
  messages: [
    ...previous,
    { role: 'user', content: `Search text not found. Did you mean: "${suggestions[0].text}"?` }
  ]
});
```

**Our approach**: Detailed errors with suggestions, AI can self-correct

### 5. Multiple Similar Code Sections

**Problem**: Document has multiple identical sections, patch is ambiguous

**Example**:
```markdown
# Section 1
Some content

# Section 2
Some content  <- Which one to change?
```

**Solutions**:

**Require more context**:
```typescript
function validatePatchUniqueness(patch, document) {
  const matches = findAllMatches(patch.search, document);
  
  if (matches.length > 1) {
    return {
      valid: false,
      error: 'Ambiguous: search text appears multiple times',
      matches: matches.map(m => ({
        position: m.position,
        context: getContext(document, m.position, 50)
      }))
    };
  }
  
  return { valid: true };
}
```

**AI provides more context**:
```
<<<SEARCH
# Section 2
Some content
===
# Section 2
Different content
>>>
```

**Our approach**: Validate uniqueness, require more context if ambiguous

### 6. Conflicting Patches

**Problem**: Two patches modify the same text

**Example**:
```
Patch 1: Change "foo" to "bar"
Patch 2: Change "foo" to "baz"
```

**Solutions**:

**Detect conflicts on apply**:
```typescript
function detectConflicts(newPatch, existingPatches) {
  for (const existing of existingPatches) {
    // Check if ranges overlap
    if (rangesOverlap(newPatch.position, existing.position)) {
      return {
        conflict: true,
        conflictsWith: existing.id
      };
    }
  }
  return { conflict: false };
}
```

**Auto-reject conflicting patch**:
```typescript
const conflict = detectConflicts(newPatch, state.patches);

if (conflict.conflict) {
  onPatchRejected(newPatch, 'conflict');
  
  // Notify user
  showNotification(
    `Patch conflicts with existing patch ${conflict.conflictsWith}`
  );
}
```

**Our approach**: Auto-reject conflicts, notify user

### 7. Whitespace/Indentation Mismatches

**Problem**: AI's indentation doesn't match file

**Solutions**:

**Progressive matching (like Aider)**:
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
  
  // All failed
  return { success: false, error: 'No match found' };
}
```

**Our approach**: Progressive fuzzy matching (exact → whitespace → fuzzy)

### 8. File Modified Since AI Last Saw It

**Problem**: User edited file, AI's patches are stale

**Solutions**:

**Version checking**:
```typescript
// Backend checks version
if (snapshot.version !== serverVersion) {
  failure(
    'Version mismatch - file was modified',
    getCurrentDocument(), // Send current state
    serverVersion
  );
}
```

**Client can reset to server state**:
```typescript
if (!result.success && result.serverDocument) {
  // Show user: "File was modified, reset to server version?"
  if (confirm('Reset to server version?')) {
    reset();
    applyPatches(parseDocument(result.serverDocument));
  }
}
```

**Our approach**: Version checking, optional recovery

### 9. Patch Would Break Markdown Structure

**Problem**: Applying patch creates invalid markdown

**Solutions**:

**Validate before applying**:
```typescript
function validateMarkdownPatch(patch, document) {
  // Apply patch to test document
  const testDoc = applyPatchToString(patch, document);
  
  // Parse with remark
  const ast = remark().parse(testDoc);
  
  // Check for errors
  if (ast.errors && ast.errors.length > 0) {
    return {
      valid: false,
      errors: ast.errors.map(e => e.message)
    };
  }
  
  return { valid: true };
}
```

**Reject invalid patches**:
```typescript
const validation = validateMarkdownPatch(patch, document);

if (!validation.valid) {
  onPatchRejected(patch, 'invalid_markdown');
  
  // Send error to AI
  return {
    error: 'InvalidMarkdown',
    errors: validation.errors,
    suggestion: 'Please ensure the replacement maintains valid markdown structure'
  };
}
```

**Our approach**: Validate markdown structure, reject invalid patches

### 10. Partial Success (Some Patches Apply, Some Fail)

**Problem**: AI sends 5 patches, 3 succeed, 2 fail

**Solutions**:

**Apply successful patches, report failures**:
```typescript
function applyPatches(patches) {
  const results = {
    success: [],
    failed: []
  };
  
  for (const patch of patches) {
    const result = applyPatch(patch, document);
    
    if (result.success) {
      results.success.push(patch.id);
    } else {
      results.failed.push({
        id: patch.id,
        error: result.error,
        patch: patch
      });
    }
  }
  
  return results;
}
```

**Inform AI of partial success**:
```typescript
const results = applyPatches(aiPatches);

if (results.failed.length > 0) {
  // Tell AI which ones failed
  const retry = await callAI({
    messages: [
      ...previous,
      {
        role: 'user',
        content: `${results.success.length} patches applied successfully. ${results.failed.length} patches failed:\n${results.failed.map(f => `- ${f.error}: ${f.patch.search.substring(0, 50)}...`).join('\n')}\n\nPlease provide corrected versions of only the failed patches.`
      }
    ]
  });
}
```

**Our approach**: Partial application, detailed failure reporting

---

## Implementation in Our Plugin

### ApplyResult Type

```typescript
interface ApplyResult {
  success: boolean;           // Overall success
  appliedCount: number;       // How many applied
  errors: ApplyError[];       // Detailed errors
}

interface ApplyError {
  type: 'parse' | 'match' | 'invalid_markdown' | 'position' | 'conflict' | 'ambiguous';
  message: string;
  patchIndex: number;
  patchData: any;
  suggestions?: string[];     // For "did you mean" errors
  context?: string;           // Surrounding text
}
```

### Validation Pipeline

```typescript
function applyPatches(patches: T[]): ApplyResult {
  const errors: ApplyError[] = [];
  let appliedCount = 0;
  
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    
    // 1. Parse
    const parsed = parsePatch(patch);
    if (!parsed.success) {
      errors.push({ type: 'parse', patchIndex: i, ... });
      continue;
    }
    
    // 2. Validate uniqueness
    const uniqueness = validateUniqueness(parsed, document);
    if (!uniqueness.valid) {
      errors.push({ type: 'ambiguous', patchIndex: i, suggestions: uniqueness.matches, ... });
      continue;
    }
    
    // 3. Validate conflicts
    const conflicts = detectConflicts(parsed, existingPatches);
    if (conflicts.conflict) {
      errors.push({ type: 'conflict', patchIndex: i, ... });
      continue;
    }
    
    // 4. Validate markdown
    const markdown = validateMarkdown(parsed, document);
    if (!markdown.valid) {
      errors.push({ type: 'invalid_markdown', patchIndex: i, ... });
      continue;
    }
    
    // 5. Apply with fuzzy matching
    const result = applyWithFuzzyMatching(parsed, document);
    if (!result.success) {
      errors.push({ type: 'match', patchIndex: i, suggestions: result.suggestions, ... });
      continue;
    }
    
    appliedCount++;
  }
  
  return {
    success: errors.length === 0,
    appliedCount,
    errors
  };
}
```

---

## Summary

**Edge cases we handle**:

1. ✅ AI returns full document → Support both modes
2. ✅ Patches extend beyond definition → Fuzzy matching + validation
3. ✅ User deletes entire doc → Single "remove all" patch
4. ✅ Search text not found → Detailed errors with suggestions
5. ✅ Multiple similar sections → Require unique context
6. ✅ Conflicting patches → Auto-reject, notify user
7. ✅ Whitespace mismatches → Progressive fuzzy matching
8. ✅ File modified (stale) → Version checking + recovery
9. ✅ Would break markdown → Validate structure before applying
10. ✅ Partial success → Apply successful, report failures

**Key strategies** (from Cline/Aider/Cursor):

- **Progressive matching**: exact → whitespace-insensitive → fuzzy
- **Detailed errors**: Tell AI exactly what went wrong and how to fix
- **Partial application**: Don't fail all patches if one fails
- **Validation pipeline**: Parse → uniqueness → conflicts → markdown → apply
- **AI self-correction**: Provide enough info for AI to retry successfully
