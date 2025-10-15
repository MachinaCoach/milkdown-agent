import { $node } from '@milkdown/utils';
import type { SuggestionAttrs } from '../types';

/**
 * Suggestion node schema definition
 */
export const agentSuggestionNode = $node('agentSuggestion', () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  attrs: {
    id: { default: '' },
    oldText: { default: '' },
    newText: { default: '' },
    metadata: { default: null },
  },
  parseDOM: [
    {
      tag: 'span[data-agent-suggestion]',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        const oldText = element.querySelector('[data-agent-suggestion-old]')?.textContent ?? '';
        const newText = element.querySelector('[data-agent-suggestion-new]')?.textContent ?? '';
        const metadata = element.getAttribute('data-agent-suggestion-meta');
        let parsed: Record<string, unknown> | null = null;
        if (metadata) {
          try {
            parsed = JSON.parse(metadata);
          } catch (error) {
            if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
              console.warn('Unable to parse suggestion metadata', error);
            }
          }
        }
        return {
          id: element.getAttribute('data-suggestion-id') ?? '',
          oldText,
          newText,
          metadata: parsed,
        } satisfies SuggestionAttrs;
      },
    },
  ],
  toDOM: (node) => {
    const { id, oldText, newText, metadata } = node.attrs as SuggestionAttrs;
    return [
      'span',
      {
        'data-agent-suggestion': 'true',
        'data-suggestion-id': id,
        'data-agent-suggestion-meta': metadata ? JSON.stringify(metadata) : undefined,
        class: 'agent-suggestion',
      },
      ['span', { 'data-agent-suggestion-old': 'true', class: 'agent-suggestion__old' }, oldText],
      ['span', { 'data-agent-suggestion-new': 'true', class: 'agent-suggestion__new' }, newText],
    ];
  },
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: (node) => node.type.name === 'agentSuggestion',
    runner: (state, node) => {
      state.addNode('text', undefined, (node.attrs.newText as string) || '');
    },
  },
}));
