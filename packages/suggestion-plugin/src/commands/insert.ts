import { createCmdKey } from '@milkdown/core';
import { $command } from '@milkdown/utils';
import type { InsertSuggestionPayload } from '../types';
import { agentSuggestionNode } from '../schema/node';

export const InsertSuggestion = createCmdKey<InsertSuggestionPayload>('InsertSuggestion');

export const insertSuggestionCommand = $command<InsertSuggestionPayload, 'InsertSuggestion'>('InsertSuggestion', (ctx) => (payload) => {
  return (state, dispatch) => {
    if (!payload) return false;
    const { from, to, id, newText } = payload;
    if (!id) return false;
    const docSize = state.doc.content.size;
    if (from < 0 || to > docSize || from >= to) return false;
    const nodeType = agentSuggestionNode.type(ctx);
    let duplicate = false;
    state.doc.descendants((node) => {
      if (node.type === nodeType && node.attrs.id === id) {
        duplicate = true;
        return false;
      }
      return true;
    });
    if (duplicate) return false;
    const oldText = payload.oldText ?? state.doc.textBetween(from, to, '\n');
    const node = nodeType.create({
      id,
      oldText,
      newText,
      metadata: payload.metadata ?? null,
    });
    if (dispatch) {
      dispatch(state.tr.replaceWith(from, to, node));
    }
    return true;
  };
});
