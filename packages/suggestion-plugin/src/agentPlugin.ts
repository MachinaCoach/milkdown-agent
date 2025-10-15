/**
 * Main Milkdown Agent Plugin
 * Provides Windsurf-like AI-assisted editing with user edit tracking
 */

import { $ctx, $prose } from '@milkdown/utils';
import type { MilkdownPlugin } from '@milkdown/ctx';
import type { SyncFunction, Patch, ChangeFormat, FlushResult } from '@milkdown-agent/core';
import { createInitialState, type PluginState } from './state.js';
import { executeFlush, simpleFlush } from './flush.js';
import { acceptPatch, rejectPatch, acceptAllPatches, rejectAllPatches, addPatch, type CommandCallbacks } from './commands.js';
import { trackUserEdits } from './tracking.js';
import { Plugin as ProseMirrorPlugin, PluginKey } from '@milkdown/prose/state';
import { createPatchDecorations, createPatchWidget } from './decorations.js';
import type { EditorView } from '@milkdown/prose/view';

export interface AgentPluginConfig<T = string> {
  /** Change format (default: 'aider') */
  changeFormat?: ChangeFormat;
  
  /** Callbacks */
  onPatchAccepted?: (patch: Patch<T>) => void;
  onPatchRejected?: (patch: Patch<T>, reason: string) => void;
  onPatchesChanged?: (patches: Patch<T>[]) => void;
}

const agentPluginKey = new PluginKey('agent-suggestion');

/**
 * Create the agent suggestion plugin
 */
export function agentSuggestion<T = string>(config: AgentPluginConfig<T> = {}): MilkdownPlugin {
  const state = createInitialState<T>();
  const callbacks: CommandCallbacks<T> = {
    onPatchAccepted: config.onPatchAccepted,
    onPatchRejected: config.onPatchRejected as any,
    onPatchesChanged: config.onPatchesChanged
  };
  
  // Set module-level state for commands
  currentState = state as any;
  currentCallbacks = callbacks as any;
  
  return $prose(() => {
    return new ProseMirrorPlugin({
      key: agentPluginKey,
      
      state: {
        init: () => state,
        apply: (tr, pluginState) => {
          // Track user edits - computed immediately on every transaction
          if (tr.docChanged) {
            // Get patches immediately (no timers!)
            const patches = trackUserEdits(tr);
            
            // Add patches
            patches.forEach(patch => {
              addPatch(state, patch as Patch<T>, callbacks);
            });
          }
          
          return pluginState;
        }
      },
      
      // Visual diff overlay with decorations
      props: {
        decorations: (editorState) => {
          const patches = Array.from(state.patches.values()) as Patch[];
          return createPatchDecorations(patches, editorState);
        },
        
        // Handle clicks on accept/reject buttons
        handleDOMEvents: {
          click: (view: EditorView, event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            // Check if clicked on a patch button
            if (target.classList.contains('milkdown-agent-patch-btn')) {
              const action = target.getAttribute('data-action');
              const patchId = target.getAttribute('data-patch-id');
              
              if (patchId) {
                if (action === 'accept') {
                  acceptPatch(state, patchId, callbacks);
                } else if (action === 'reject') {
                  rejectPatch(state, patchId, 'explicit', callbacks);
                }
                
                // Prevent default and stop propagation
                event.preventDefault();
                event.stopPropagation();
                return true;
              }
            }
            
            return false;
          }
        }
      }
    });
  });
}

/**
 * Get the plugin state from the editor
 * This is a helper for accessing the state from outside the plugin
 */
export function getAgentState<T = string>(): PluginState<T> | null {
  // This will be set by the plugin when it's initialized
  return currentState as PluginState<T> | null;
}

// Internal state reference (set by plugin)
let currentState: PluginState<any> | null = null;
let currentCallbacks: CommandCallbacks<any> | null = null;

/**
 * Plugin commands (exported for use in editor)
 * These can be called directly without Milkdown context
 */
export const agentCommands = {
  /**
   * Flush with sync
   */
  flush: async <T>(syncFn: SyncFunction<T>): Promise<FlushResult> => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    return executeFlush(currentState, syncFn);
  },
  
  /**
   * Simple flush (no sync)
   */
  simpleFlush: (): void => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    simpleFlush(currentState);
  },
  
  /**
   * Accept a patch
   */
  acceptPatch: (patchId: string): boolean => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    return acceptPatch(currentState, patchId, currentCallbacks || undefined);
  },
  
  /**
   * Reject a patch
   */
  rejectPatch: (patchId: string): boolean => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    return rejectPatch(currentState, patchId, 'explicit', currentCallbacks || undefined);
  },
  
  /**
   * Accept all patches
   */
  acceptAllPatches: (): void => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    acceptAllPatches(currentState, currentCallbacks || undefined);
  },
  
  /**
   * Reject all patches
   */
  rejectAllPatches: (): void => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    rejectAllPatches(currentState, currentCallbacks || undefined);
  },
  
  /**
   * Get current patches
   */
  getPatches: <T = string>(): Patch<T>[] => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    return Array.from(currentState.patches.values());
  },
  
  /**
   * Get current version
   */
  getVersion: (): number => {
    if (!currentState) {
      throw new Error('Agent plugin not initialized');
    }
    return currentState.version;
  }
};

export { type Patch, type SyncFunction, type ChangeFormat } from '@milkdown-agent/core';
