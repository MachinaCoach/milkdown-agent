import { createCmdKey, editorViewCtx } from '@milkdown/core';
import { $command } from '@milkdown/utils';
import type { SuggestionSnapshot } from '../types';
import { agentSuggestionNode } from '../schema/node';
import { suggestionCallbacksCtx } from '../context';
import { collectSuggestions } from '../utils/collect';

export const RejectSuggestion = createCmdKey<string>('RejectSuggestion');

export const rejectSuggestionCommand = $command<string, 'RejectSuggestion'>('RejectSuggestion', (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    let rejectedSuggestion: SuggestionSnapshot | null = null;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        rejectedSuggestion = {
          id: node.attrs.id,
          oldText: node.attrs.oldText,
          newText: node.attrs.newText,
          metadata: node.attrs.metadata,
          pos,
        };
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.oldText));
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
      // Trigger callbacks after transaction
      const callbacks = ctx.get(suggestionCallbacksCtx.key);
      if (rejectedSuggestion && callbacks.onSuggestionRejected) {
        callbacks.onSuggestionRejected(rejectedSuggestion);
      }
      if (callbacks.onSuggestionsChanged) {
        const view = ctx.get(editorViewCtx);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});
