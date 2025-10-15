/**
 * Flush command with callback-based sync
 * Reference: START_HERE.md lines 100-130, PLUGIN_CONTRACT_V6.md lines 85-92
 */

import type { SyncFunction, SyncSnapshot, FlushResult, Patch } from '@milkdown-agent/core';
import type { PluginState } from './state.js';
import { clearPendingChanges, incrementVersion } from './state.js';
import { applyPatchesToDocument, formatPatchError } from './applyPatches.js';
import { parseAiderFormat } from '@milkdown-agent/core';

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
  // TODO: Implement - get editor content with patches inline
  return '';
}

/**
 * Execute flush with sync function
 * Reference: IMPLEMENTATION_SPEC.md lines 227-244
 */
export async function executeFlush<T>(
  state: PluginState<T>,
  syncFn: SyncFunction<T>
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
          // Patch mode
          // TODO: Apply patches
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
