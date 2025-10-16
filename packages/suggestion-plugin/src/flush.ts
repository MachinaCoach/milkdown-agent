/**
 * Flush command with callback-based sync
 * Reference: START_HERE.md lines 100-130, PLUGIN_CONTRACT_V6.md lines 85-92
 */

import type { SyncFunction, SyncSnapshot, FlushResult, Patch } from '@milkdown-agent/core';
import { createPatchId } from '@milkdown-agent/core';
import type { PluginState } from './state.js';
import { clearPendingChanges, incrementVersion } from './state.js';
import { addPatch, type CommandCallbacks } from './commands.js';

/**
 * Create snapshot from current state
 */
export function createSnapshot<T>(state: PluginState<T>): SyncSnapshot {
  return {
    version: state.version,
    hasDocumentChanges: state.pendingChanges.hasDocumentChanges,
    hasPatchChanges: state.pendingChanges.hasPatchChanges,
    documentWithPatches: state.pendingChanges.hasDocumentChanges 
      ? getDocumentWithPatches(state) 
      : undefined,
    patches: state.pendingChanges.hasPatchChanges 
      ? (Array.from(state.patches.values()).map(p => p.data) as any)
      : undefined,
    acceptedPatches: Array.from(state.pendingChanges.acceptedPatches),
    rejectedPatches: Array.from(state.pendingChanges.rejectedPatches),
    newPatches: Array.from(state.pendingChanges.newPatches)
  };
}

/**
 * Get document with all patches inline
 */
function getDocumentWithPatches<T>(state: PluginState<T>): string {
  return state.documentText;
}

/**
 * Execute flush with sync function
 * Reference: IMPLEMENTATION_SPEC.md lines 227-244
 */
export async function executeFlush<T>(
  state: PluginState<T>,
  syncFn: SyncFunction<T>,
  callbacks?: CommandCallbacks<T>
): Promise<FlushResult> {
  const snapshot = createSnapshot(state);
  const initialVersion = state.version;

  return new Promise((resolve) => {
    // Success callback
    const success = (patchesOrDocument?: T[] | string, version?: number) => {
      try {
        // Apply patches or document
        if (typeof patchesOrDocument === 'string') {
          // Full document mode
          // TODO: Parse and apply document
        } else if (Array.isArray(patchesOrDocument)) {
          // Patch mode - convert backend patches to internal format
          let workingDocument = state.documentText;

          for (const patchData of patchesOrDocument) {
            const instrumented = toInstrumentedPatch(patchData, workingDocument);

            if (!instrumented) {
              continue;
            }

            workingDocument = instrumented.updatedDocument;
            addPatch(state, instrumented.patch as Patch<T>, callbacks);
          }
        }

        // Increment version
        if (version !== undefined) {
          state.version = version;
        } else {
          incrementVersion(state);
        }
        
        // Clear pending changes
        clearPendingChanges(state);
        
        resolve({
          success: true,
          version: state.version
        });
      } catch (error) {
        // Rollback on error
        state.version = initialVersion;
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
    
    // Failure callback
    const failure = (error: string, serverDocument?: string, serverVersion?: number) => {
      // Don't increment version on failure
      resolve({
        success: false,
        error,
        serverDocument,
        serverVersion
      });
    };
    
    // Execute sync function
    try {
      const result = syncFn(snapshot, success, failure);
      
      // Handle promise or void
      if (result instanceof Promise) {
        result.catch((error) => {
          failure(error.message || 'Sync function failed');
        });
      }
    } catch (error) {
      failure(error instanceof Error ? error.message : 'Sync function threw error');
    }
  });
}

/**
 * Simple flush without sync (just commit locally)
 */
export function simpleFlush<T>(state: PluginState<T>): void {
  incrementVersion(state);
  clearPendingChanges(state);
}

interface ParsedPatchData {
  search: string;
  replace: string;
}

function detectOperation(search: string, replace: string): Patch['operation'] {
  if (!search.trim() && replace.trim()) {
    return 'add';
  }
  if (search.trim() && !replace.trim()) {
    return 'remove';
  }
  return 'change';
}

function extractPatchParts(patch: unknown): ParsedPatchData | null {
  if (typeof patch === 'string') {
    const match = patch.match(/<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/);
    if (match) {
      return { search: match[1], replace: match[2] };
    }
  }

  if (typeof patch === 'object' && patch !== null) {
    const maybePatch = patch as Record<string, unknown>;
    if (typeof maybePatch.search === 'string' && typeof maybePatch.replace === 'string') {
      return { search: maybePatch.search, replace: maybePatch.replace };
    }
  }

  return null;
}

function toInstrumentedPatch<T>(patchData: T, document: string): {
  patch: Patch<T>;
  updatedDocument: string;
} | null {
  const parts = extractPatchParts(patchData);
  if (!parts) {
    return null;
  }

  const { search, replace } = parts;
  const operation = detectOperation(search, replace);
  const id = createPatchId(search, replace);

  let position = 0;
  let updatedDocument = document;

  if (search) {
    const index = document.indexOf(search);
    if (index !== -1) {
      position = index;
      updatedDocument =
        document.slice(0, index) + replace + document.slice(index + search.length);
    } else {
      position = document.length;
    }
  } else {
    position = document.length;
    updatedDocument = document + replace;
  }

  return {
    patch: {
      id,
      data: patchData,
      operation,
      source: 'instrumented',
      position
    },
    updatedDocument
  };
}
