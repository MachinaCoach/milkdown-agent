import { createCmdKey } from '@milkdown/core';
import { $command } from '@milkdown/utils';
import { agentSuggestionNode } from '../schema/node';

export const AcceptAllSuggestions = createCmdKey('AcceptAllSuggestions');
export const RejectAllSuggestions = createCmdKey('RejectAllSuggestions');

export const acceptAllSuggestionsCommand = $command<void, 'AcceptAllSuggestions'>('AcceptAllSuggestions', (ctx) => () => {
  return (state, dispatch) => {
    let changed = false;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType) {
        changed = true;
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.newText));
        return false;
      }
      return true;
    });
    if (changed && dispatch) {
      dispatch(tr);
    }
    return changed;
  };
});

export const rejectAllSuggestionsCommand = $command<void, 'RejectAllSuggestions'>('RejectAllSuggestions', (ctx) => () => {
  return (state, dispatch) => {
    let changed = false;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType) {
        changed = true;
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.oldText));
        return false;
      }
      return true;
    });
    if (changed && dispatch) {
      dispatch(tr);
    }
    return changed;
  };
});
