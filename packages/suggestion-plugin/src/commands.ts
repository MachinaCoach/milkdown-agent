/**
 * Accept/reject commands for patches
 * Reference: START_HERE.md lines 132-138, IMPLEMENTATION_SPEC.md lines 76-82
 */

import type { Patch, RejectReason } from '@milkdown-agent/core';
import type { PluginState } from './state.js';

export type PatchCallback<T> = (patch: Patch<T>) => void;
export type RejectCallback<T> = (patch: Patch<T>, reason: RejectReason) => void;

export interface CommandCallbacks<T> {
  onPatchAccepted?: PatchCallback<T>;
  onPatchRejected?: RejectCallback<T>;
  onPatchesChanged?: (patches: Patch<T>[]) => void;
}

/**
 * Accept a patch
 * Reference: IMPLEMENTATION_SPEC.md lines 346-353
 */
export function acceptPatch<T>(
  state: PluginState<T>,
  patchId: string,
  callbacks?: CommandCallbacks<T>
): boolean {
  const patch = state.patches.get(patchId);
  if (!patch) {
    return false;
  }
  
  // Remove from patches
  state.patches.delete(patchId);
  
  // Track as accepted
  state.pendingChanges.acceptedPatches.add(patchId);
  state.pendingChanges.hasPatchChanges = true;
  
  // Fire callback
  callbacks?.onPatchAccepted?.(patch);
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
  
  return true;
}

/**
 * Reject a patch
 * Reference: IMPLEMENTATION_SPEC.md lines 355-362
 */
export function rejectPatch<T>(
  state: PluginState<T>,
  patchId: string,
  reason: RejectReason,
  callbacks?: CommandCallbacks<T>
): boolean {
  const patch = state.patches.get(patchId);
  if (!patch) {
    return false;
  }
  
  // Remove from patches
  state.patches.delete(patchId);
  
  // Track as rejected
  state.pendingChanges.rejectedPatches.add(patchId);
  state.pendingChanges.hasPatchChanges = true;
  
  // Fire callback
  callbacks?.onPatchRejected?.(patch, reason);
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
  
  return true;
}

/**
 * Accept all patches
 */
export function acceptAllPatches<T>(
  state: PluginState<T>,
  callbacks?: CommandCallbacks<T>
): void {
  const patchIds = Array.from(state.patches.keys());
  
  for (const id of patchIds) {
    acceptPatch(state, id, callbacks);
  }
}

/**
 * Reject all patches
 */
export function rejectAllPatches<T>(
  state: PluginState<T>,
  callbacks?: CommandCallbacks<T>
): void {
  const patchIds = Array.from(state.patches.keys());
  
  for (const id of patchIds) {
    rejectPatch(state, id, 'explicit', callbacks);
  }
}

/**
 * Add a new patch (from AI or user edit)
 */
export function addPatch<T>(
  state: PluginState<T>,
  patch: Patch<T>,
  callbacks?: CommandCallbacks<T>
): void {
  state.patches.set(patch.id, patch);
  state.pendingChanges.newPatches.add(patch.id);
  state.pendingChanges.hasPatchChanges = true;
  
  if (patch.source === 'inline') {
    state.pendingChanges.hasDocumentChanges = true;
  }
  
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
}
