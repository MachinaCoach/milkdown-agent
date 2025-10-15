/**
 * User edit tracking - 4-phase algorithm
 * 
 * Based on research (see ALGORITHM.md):
 * - Operational Transformation (Ellis & Gibbs, 1989)
 * - ProseMirror Collaborative Editing
 * - Microsoft Word Track Changes
 * 
 * Phase 1: Extract changes from ProseMirror Steps
 * Phase 2: Group by position (merge at same location)
 * Phase 3: Convert to Aider format patches
 * Phase 4: Reconcile conflicts
 */

import type { Transaction } from '@milkdown/prose/state';
import type { Patch } from '@milkdown-agent/core';
import { createPatchId, formatAsPatch } from '@milkdown-agent/core';

// Phase 2: Track changes by position (like Microsoft Word)
const changesByPosition = new Map<number, Change>();

export interface Change {
  from: number;
  to: number;
  oldText: string;  // Original text (for merging)
  newText: string;  // Current text
  operation: 'add' | 'change' | 'remove';
}

/**
 * Main tracking function - implements 4-phase algorithm
 * Called on every transaction (no timers!)
 */
export function trackUserEdits(tr: Transaction): Patch<string>[] {
  if (!tr.docChanged) {
    return [];
  }
  
  const patches: Patch<string>[] = [];
  const beforeDoc = tr.docs[0];
  const afterDoc = tr.doc;
  
  // Phase 1: Extract changes from ProseMirror Steps
  for (const step of tr.steps) {
    const stepMap = step.getMap();
    
    stepMap.forEach((oldStart: number, oldEnd: number, newStart: number, newEnd: number) => {
      const oldSize = oldEnd - oldStart;
      const newSize = newEnd - newStart;
      
      // Get actual text at positions
      const oldText = beforeDoc ? beforeDoc.textBetween(oldStart, oldEnd) : '';
      const newText = afterDoc.textBetween(newStart, newEnd);
      
      // Determine operation
      let operation: 'add' | 'change' | 'remove';
      if (oldSize === 0 && newSize > 0) {
        operation = 'add';
      } else if (oldSize > 0 && newSize === 0) {
        operation = 'remove';
      } else {
        operation = 'change';
      }
      
      // Phase 2: Group by position (merge if exists)
      const existingChange = changesByPosition.get(newStart);
      
      if (existingChange) {
        // Merge with existing change at this position
        const merged: Change = {
          from: newStart,
          to: newEnd,
          oldText: existingChange.oldText, // Keep original
          newText: newText,                 // Update to latest
          operation: existingChange.operation
        };
        changesByPosition.set(newStart, merged);
        
        // Phase 3: Convert to patch
        const patch = changeToPatch(merged);
        patches.push(patch);
      } else {
        // New change at this position
        const change: Change = {
          from: newStart,
          to: newEnd,
          oldText,
          newText,
          operation
        };
        changesByPosition.set(newStart, change);
        
        // Phase 3: Convert to patch
        const patch = changeToPatch(change);
        patches.push(patch);
      }
    });
  }
  
  // Phase 4: Reconcile conflicts
  return reconcilePatches(patches);
}

/**
 * Phase 3: Convert Change to Patch (Aider format)
 */
function changeToPatch(change: Change): Patch<string> {
  const data = formatAsPatch(change.oldText, change.newText);
  const id = createPatchId(change.oldText, change.newText);
  
  return {
    id,
    data,
    operation: change.operation,
    source: 'inline',
    position: change.from
  };
}

/**
 * Phase 4: Reconcile patches (handle overlaps)
 */
function reconcilePatches(patches: Patch<string>[]): Patch<string>[] {
  if (patches.length === 0) return [];
  
  const reconciled: Patch<string>[] = [];
  const seen = new Set<string>();
  
  for (const patch of patches) {
    // Skip duplicates (same ID)
    if (seen.has(patch.id)) {
      continue;
    }
    seen.add(patch.id);
    
    // Check for overlapping patches
    const overlapping = reconciled.find(p => 
      p.position === patch.position && p.id !== patch.id
    );
    
    if (overlapping) {
      // Replace with newer patch at same position
      const index = reconciled.indexOf(overlapping);
      reconciled[index] = patch;
    } else {
      reconciled.push(patch);
    }
  }
  
  return reconciled;
}

/**
 * Clear tracked changes (e.g., after accept/reject)
 */
export function clearChangeAtPosition(position: number): void {
  changesByPosition.delete(position);
}

/**
 * Clear all tracked changes
 */
export function clearAllChanges(): void {
  changesByPosition.clear();
}
