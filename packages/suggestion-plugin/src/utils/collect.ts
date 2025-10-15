import type { Node as ProseNode } from '@milkdown/prose/model';
import type { SuggestionSnapshot } from '../types';

/**
 * Collect all suggestions currently in the document
 */
export const collectSuggestions = (doc: ProseNode): SuggestionSnapshot[] => {
  const results: SuggestionSnapshot[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'agentSuggestion') {
      results.push({
        id: node.attrs.id,
        oldText: node.attrs.oldText,
        newText: node.attrs.newText,
        metadata: node.attrs.metadata,
        pos,
      });
    }
    return true;
  });
  return results;
};
