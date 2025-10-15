/**
 * Plugin state management
 * Reference: IMPLEMENTATION_SPEC.md lines 518-560
 */

import type { Patch } from '@milkdown-agent/core';

export interface PluginState<T = string> {
  /** Current version (increments only on flush) */
  version: number;
  
  /** All active patches (ID → Patch) */
  patches: Map<string, Patch<T>>;
  
  /** Pending changes (cleared on flush) */
  pendingChanges: {
    hasDocumentChanges: boolean;
    hasPatchChanges: boolean;
    acceptedPatches: Set<string>;
    rejectedPatches: Set<string>;
    newPatches: Set<string>;
  };
}

export function createInitialState<T = string>(): PluginState<T> {
  return {
    version: 1,
    patches: new Map(),
    pendingChanges: {
      hasDocumentChanges: false,
      hasPatchChanges: false,
      acceptedPatches: new Set(),
      rejectedPatches: new Set(),
      newPatches: new Set()
    }
  };
}

export function clearPendingChanges<T>(state: PluginState<T>): void {
  state.pendingChanges.hasDocumentChanges = false;
  state.pendingChanges.hasPatchChanges = false;
  state.pendingChanges.acceptedPatches.clear();
  state.pendingChanges.rejectedPatches.clear();
  state.pendingChanges.newPatches.clear();
}

export function incrementVersion<T>(state: PluginState<T>): void {
  state.version++;
}
