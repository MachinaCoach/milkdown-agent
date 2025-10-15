import { createCmdKey, editorViewCtx } from '@milkdown/core';
import { $command } from '@milkdown/utils';
import type { SuggestionSnapshot } from '../types';
import { agentSuggestionNode } from '../schema/node';
import { suggestionCallbacksCtx } from '../context';
import { collectSuggestions } from '../utils/collect';

export const AcceptSuggestion = createCmdKey<string>('AcceptSuggestion');

export const acceptSuggestionCommand = $command<string, 'AcceptSuggestion'>('AcceptSuggestion', (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    let acceptedSuggestion: SuggestionSnapshot | null = null;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        acceptedSuggestion = {
          id: node.attrs.id,
          oldText: node.attrs.oldText,
          newText: node.attrs.newText,
          metadata: node.attrs.metadata,
          pos,
        };
        const newText = node.attrs.newText;
        // If newText is empty (REMOVE operation), delete the node
        if (!newText || newText.length === 0) {
          tr.delete(pos, pos + node.nodeSize);
        } else {
          tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(newText));
        }
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
      // Trigger callbacks after transaction
      const callbacks = ctx.get(suggestionCallbacksCtx.key);
      if (acceptedSuggestion && callbacks.onSuggestionAccepted) {
        callbacks.onSuggestionAccepted(acceptedSuggestion);
      }
      if (callbacks.onSuggestionsChanged) {
        const view = ctx.get(editorViewCtx);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});
