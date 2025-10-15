# Plugin Contract v6: Callback-Based Sync

## Key Improvement from v5

**v5 required returning a response object**:
```typescript
await flush(async (snapshot) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  return response.json();  // { success, version, patches, error }
});
```

**v6 uses callbacks for better DX**:
```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    success(data.patches, data.version);
  } else {
    failure(data.error, data.serverDocument, data.serverVersion);
  }
});
```

---

## Configuration

```typescript
agentSuggestion({
  changeFormat: 'aider' | 'anthropic' | 'unified-diff' | 'custom',
  customFormat?: {
    searchMarker: string,
    replaceMarker: string,
    separator: string
  }
})
```

---

## Methods

### State Extraction

**getDocument(): string**
**getDocumentWithPatches(): string**
**getVersion(): number**
**getPatches<T>(): Patch<T>[]**
**serializePatches<T>(patches: Patch<T>[]): T[]**

### State Application & Sync

**applyPatches<T>(patches: T[]): ApplyResult**

**flush(): void**
**flush<T>(syncFn: SyncFunction<T>): Promise<FlushResult>**

```typescript
type SyncFunction<T> = (
  snapshot: SyncSnapshot,
  success: SuccessCallback<T>,
  failure: FailureCallback
) => Promise<void> | void;

type SuccessCallback<T> = (
  patches?: T[],           // Optional: new patches to apply
  version?: number         // Optional: new version (defaults to snapshot.version + 1)
) => void;

type FailureCallback = (
  error: string,           // Error message
  serverDocument?: string, // Optional: server's doc for recovery
  serverVersion?: number   // Optional: server's version for debugging
) => void;
```

**reset(): void**

### Manual Control

**acceptPatch(id: string): void**
**rejectPatch(id: string): void**
**acceptAllPatches(): void**
**rejectAllPatches(): void**

---

## Callbacks

**onPatchAccepted(patch: Patch<T>): void**
**onPatchRejected(patch: Patch<T>, reason: RejectReason): void**
**onPatchesChanged(patches: Patch<T>[]): void**

---

## Types

```typescript
interface Patch<T> {
  id: string;
  data: T;
  operation: 'add' | 'change' | 'remove';
  source: 'instrumented' | 'inline';
  position: number;
  section?: string;
}

interface SyncSnapshot {
  version: number;
  hasDocumentChanges: boolean;
  hasPatchChanges: boolean;
  documentWithPatches?: string;
  patches?: string[];
  acceptedPatches?: string[];
  rejectedPatches?: string[];
  newPatches?: string[];
}

type SyncFunction<T> = (
  snapshot: SyncSnapshot,
  success: SuccessCallback<T>,
  failure: FailureCallback
) => Promise<void> | void;

type SuccessCallback<T> = (
  patches?: T[],
  version?: number
) => void;

type FailureCallback = (
  error: string,
  serverDocument?: string,
  serverVersion?: number
) => void;

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
  type: 'parse' | 'match' | 'invalid_markdown' | 'position' | 'conflict';
  message: string;
  patchIndex?: number;
  patchData?: any;
}

type RejectReason = 'explicit' | 'modified' | 'deleted' | 'conflict';
```

---

## Usage Patterns

### Pattern 1: Success with Patches

```typescript
const result = await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    // Success with new patches
    success(data.patches);
    // Version auto-increments to snapshot.version + 1
  } else {
    failure(data.error);
  }
});

if (result.success) {
  console.log('Synced at version', result.version);
}
```

### Pattern 2: Success with Custom Version

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    // Success with custom version from server
    success(data.patches, data.serverVersion);
  } else {
    failure(data.error);
  }
});
```

### Pattern 3: Success with No Patches

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    // Success but no new patches
    success();
    // Version still increments
  } else {
    failure(data.error);
  }
});
```

### Pattern 4: Failure with Recovery

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    success(data.patches);
  } else {
    // Failure with server state for recovery
    failure(
      data.error,
      data.serverDocument,  // Plugin will store this
      data.serverVersion
    );
  }
});
```

### Pattern 5: Failure without Recovery

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    success(data.patches);
  } else {
    // Failure, no recovery data
    failure(data.error);
  }
});
```

---

## How It Works

### Success Callback

```typescript
success(patches?, version?)
```

**Parameters**:
- `patches` (optional): New patches to apply
- `version` (optional): New version (defaults to `snapshot.version + 1`)

**Plugin behavior**:
1. Applies `patches` if provided
2. Sets version to `version` if provided, else `snapshot.version + 1`
3. Clears pending changes
4. Returns `{ success: true, version: N }`

**Examples**:
```typescript
success();                          // No patches, version auto-increments
success(patches);                   // Apply patches, version auto-increments
success(patches, 10);               // Apply patches, set version to 10
success(undefined, 10);             // No patches, set version to 10
```

### Failure Callback

```typescript
failure(error, serverDocument?, serverVersion?)
```

**Parameters**:
- `error` (required): Error message
- `serverDocument` (optional): Server's document for recovery
- `serverVersion` (optional): Server's version for debugging

**Plugin behavior**:
1. Does NOT increment version
2. Does NOT apply any patches
3. Stores `serverDocument` if provided
4. Returns `{ success: false, error, serverDocument?, serverVersion? }`

**Examples**:
```typescript
failure('Network error');                              // Simple error
failure('Version mismatch', serverDoc);                // With recovery doc
failure('Version mismatch', serverDoc, serverVersion); // With recovery + version
failure('Version mismatch', undefined, serverVersion); // Version only
```

---

## Complete Examples

### Example 1: Simple Sync

```typescript
const result = await flush(async (snapshot, success, failure) => {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify(snapshot)
    });
    
    if (!response.ok) {
      failure('Server error');
      return;
    }
    
    const data = await response.json();
    success(data.patches);
    
  } catch (error) {
    failure(error.message);
  }
});

if (result.success) {
  console.log('Synced at version', result.version);
} else {
  console.error('Sync failed:', result.error);
}
```

### Example 2: With Version Checking

```typescript
const result = await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.versionMismatch) {
    // Server detected version mismatch
    failure(
      'Version mismatch',
      data.serverDocument,
      data.serverVersion
    );
    return;
  }
  
  if (data.ok) {
    success(data.patches, data.newVersion);
  } else {
    failure(data.error);
  }
});

if (!result.success && result.serverDocument) {
  // Recover from server state
  console.log('Recovering from server version', result.serverVersion);
  reset();
  // Parse and apply result.serverDocument
}
```

### Example 3: Background Polling

```typescript
agentSuggestion({
  onPatchesChanged: setPatches
});

useEffect(() => {
  const interval = setInterval(async () => {
    if (hasNewTranscript()) {
      const transcript = getLatestTranscript();
      
      const result = await flush(async (snapshot, success, failure) => {
        const response = await fetch('/api/suggest', {
          body: JSON.stringify({
            ...snapshot,
            context: { transcript }
          })
        });
        
        const data = await response.json();
        
        if (data.ok) {
          success(data.patches);
        } else {
          failure(data.error);
        }
      });
      
      if (!result.success) {
        console.error('Sync failed:', result.error);
      }
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

### Example 4: With Retry on Conflict

```typescript
async function syncWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await flush(async (snapshot, success, failure) => {
      const response = await fetch('/api/sync', {
        body: JSON.stringify(snapshot)
      });
      
      const data = await response.json();
      
      if (data.ok) {
        success(data.patches, data.version);
      } else if (data.conflict) {
        failure(
          'Version conflict',
          data.serverDocument,
          data.serverVersion
        );
      } else {
        failure(data.error);
      }
    });
    
    if (result.success) {
      console.log('Synced at version', result.version);
      return result;
    }
    
    // Check if we can recover
    if (result.serverDocument) {
      console.log('Conflict detected, recovering from server...');
      reset();
      // Parse and apply result.serverDocument
      continue;
    }
    
    // Can't recover
    console.error('Sync failed:', result.error);
    return result;
  }
}
```

---

## Backend Examples

### Example 1: Simple Success

```typescript
app.post('/api/sync', async (req, res) => {
  const snapshot = req.body;
  
  try {
    const patches = await generatePatches(snapshot);
    
    res.json({
      ok: true,
      patches: patches
      // version omitted, client auto-increments
    });
    
  } catch (error) {
    res.json({
      ok: false,
      error: error.message
    });
  }
});
```

**Client calls**:
```typescript
if (data.ok) {
  success(data.patches);  // Version auto-increments
} else {
  failure(data.error);
}
```

### Example 2: With Version Control

```typescript
app.post('/api/sync', async (req, res) => {
  const { version } = req.body;
  const expectedVersion = getExpectedVersion();
  
  if (version !== expectedVersion) {
    res.json({
      ok: false,
      conflict: true,
      error: 'Version mismatch',
      serverVersion: expectedVersion,
      serverDocument: getCurrentDocument()
    });
    return;
  }
  
  const patches = await generatePatches(req.body);
  
  res.json({
    ok: true,
    patches: patches,
    version: expectedVersion + 1  // Explicit version
  });
});
```

**Client calls**:
```typescript
if (data.ok) {
  success(data.patches, data.version);
} else if (data.conflict) {
  failure(data.error, data.serverDocument, data.serverVersion);
} else {
  failure(data.error);
}
```

### Example 3: Conditional Recovery

```typescript
app.post('/api/sync', async (req, res) => {
  const { version } = req.body;
  const expectedVersion = getExpectedVersion();
  
  if (version !== expectedVersion) {
    const diff = Math.abs(version - expectedVersion);
    
    if (diff > 10) {
      // Too far out of sync - provide recovery
      res.json({
        ok: false,
        error: 'Too far out of sync',
        serverDocument: getCurrentDocument(),
        serverVersion: expectedVersion
      });
    } else {
      // Close enough - just error
      res.json({
        ok: false,
        error: 'Version mismatch, please retry',
        serverVersion: expectedVersion
      });
    }
    return;
  }
  
  const patches = await generatePatches(req.body);
  res.json({ ok: true, patches });
});
```

**Client calls**:
```typescript
if (data.ok) {
  success(data.patches);
} else {
  failure(data.error, data.serverDocument, data.serverVersion);
}
```

---

## Benefits

### 1. Clear Intent

**v5 (return object)**:
```typescript
return { success: true, version: 2, patches: [...] };
```

**v6 (callbacks)**:
```typescript
success(patches, version);
```

More explicit, clearer intent.

### 2. Flexible Parameters

**All optional**:
```typescript
success();                    // No patches, version auto-increments
success(patches);             // Patches, version auto-increments
success(patches, version);    // Patches + custom version
success(undefined, version);  // No patches, custom version

failure('Error');                          // Simple error
failure('Error', serverDoc);               // With recovery
failure('Error', serverDoc, serverVer);    // With recovery + version
```

### 3. No Return Value Needed

**v5**:
```typescript
return response.json();  // Must return
```

**v6**:
```typescript
success(data.patches);  // Just call callback
// No return needed
```

### 4. Cleaner Error Handling

**v5**:
```typescript
if (data.ok) {
  return { success: true, patches: data.patches };
} else {
  return { success: false, error: data.error };
}
```

**v6**:
```typescript
if (data.ok) {
  success(data.patches);
} else {
  failure(data.error);
}
```

### 5. Better TypeScript Inference

Callbacks are typed, so TypeScript knows what parameters are valid.

---

## Migration from v5

### Before (v5)

```typescript
await flush(async (snapshot) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  return {
    success: data.ok,
    version: data.version,
    patches: data.patches,
    error: data.error,
    serverDocument: data.serverDocument
  };
});
```

### After (v6)

```typescript
await flush(async (snapshot, success, failure) => {
  const response = await fetch('/api/sync', {
    body: JSON.stringify(snapshot)
  });
  
  const data = await response.json();
  
  if (data.ok) {
    success(data.patches, data.version);
  } else {
    failure(data.error, data.serverDocument);
  }
});
```

---

## API Summary

### Methods (9 total)

```typescript
getDocument(): string
getDocumentWithPatches(): string
getVersion(): number
getPatches<T>(): Patch<T>[]
serializePatches<T>(patches: Patch<T>[]): T[]

applyPatches<T>(patches: T[]): ApplyResult
flush(): void
flush<T>(syncFn: SyncFunction<T>): Promise<FlushResult>
reset(): void

acceptPatch(id: string): void
rejectPatch(id: string): void
acceptAllPatches(): void
rejectAllPatches(): void
```

### Callbacks (3 total)

```typescript
onPatchAccepted?: (patch: Patch<T>) => void
onPatchRejected?: (patch: Patch<T>, reason: RejectReason) => void
onPatchesChanged?: (patches: Patch<T>[]) => void
```

### Types (8 total)

```typescript
interface Patch<T> { ... }
interface SyncSnapshot { ... }
type SyncFunction<T> = (snapshot, success, failure) => Promise<void> | void
type SuccessCallback<T> = (patches?, version?) => void
type FailureCallback = (error, serverDocument?, serverVersion?) => void
interface FlushResult { ... }
interface ApplyResult { ... }
type RejectReason = 'explicit' | 'modified' | 'deleted' | 'conflict';
```

---

## Summary

**v6 uses callbacks for better DX**:

1. ✅ **Clear intent** - `success()` vs `failure()`
2. ✅ **Flexible** - All parameters optional
3. ✅ **No return needed** - Just call callback
4. ✅ **Cleaner code** - Less boilerplate
5. ✅ **Better types** - TypeScript inference

**Result**: More ergonomic than v5's return-object approach.
