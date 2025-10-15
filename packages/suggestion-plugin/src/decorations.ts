/**
 * Visual diff decorations for patches
 * Reference: START_HERE.md lines 140-149, IMPLEMENTATION_SPEC.md lines 317-332
 */

import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { EditorState } from '@milkdown/prose/state';
import type { Patch } from '@milkdown-agent/core';

/**
 * Create decorations for all patches
 */
export function createPatchDecorations(patches: Patch[], state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];
  
  for (const patch of patches) {
    const decoration = createPatchDecoration(patch, state);
    if (decoration) {
      decorations.push(decoration);
    }
  }
  
  return DecorationSet.create(state.doc, decorations);
}

/**
 * Create a decoration for a single patch
 */
function createPatchDecoration(patch: Patch, state: EditorState): Decoration | null {
  const { position, operation, id, source } = patch;
  
  // Determine decoration class based on operation
  const className = getDecorationClass(operation, source);
  
  // Create inline decoration
  const decoration = Decoration.inline(
    position,
    position + 1, // TODO: Calculate actual end position
    {
      class: className,
      'data-patch-id': id,
      'data-patch-operation': operation,
      'data-patch-source': source
    }
  );
  
  return decoration;
}

/**
 * Get CSS class for decoration based on operation and source
 */
function getDecorationClass(operation: string, source: string): string {
  const baseClass = 'milkdown-agent-patch';
  const operationClass = `${baseClass}--${operation}`;
  const sourceClass = source === 'inline' ? `${baseClass}--user` : `${baseClass}--ai`;
  
  return `${baseClass} ${operationClass} ${sourceClass}`;
}

/**
 * Create widget decoration for accept/reject buttons
 */
export function createPatchWidget(patch: Patch, position: number): Decoration {
  const widget = document.createElement('span');
  widget.className = 'milkdown-agent-patch-controls';
  widget.setAttribute('data-patch-id', patch.id);
  
  // Accept button
  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'milkdown-agent-patch-btn milkdown-agent-patch-btn--accept';
  acceptBtn.textContent = '✓';
  acceptBtn.title = 'Accept change';
  acceptBtn.setAttribute('data-action', 'accept');
  acceptBtn.setAttribute('data-patch-id', patch.id);
  
  // Reject button
  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'milkdown-agent-patch-btn milkdown-agent-patch-btn--reject';
  rejectBtn.textContent = '✗';
  rejectBtn.title = 'Reject change';
  rejectBtn.setAttribute('data-action', 'reject');
  rejectBtn.setAttribute('data-patch-id', patch.id);
  
  widget.appendChild(acceptBtn);
  widget.appendChild(rejectBtn);
  
  return Decoration.widget(position, widget, {
    side: 1,
    key: `patch-controls-${patch.id}`
  });
}

/**
 * Update decorations when patches change
 */
export function updateDecorations(
  oldDecorations: DecorationSet,
  patches: Patch[],
  state: EditorState
): DecorationSet {
  // For now, recreate all decorations
  // TODO: Optimize by only updating changed patches
  return createPatchDecorations(patches, state);
}
