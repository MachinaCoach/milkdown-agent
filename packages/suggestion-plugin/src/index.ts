import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { commandsCtx, editorViewOptionsCtx, createCmdKey } from '@milkdown/core';
import { $node, $command } from '@milkdown/utils';
import type { Node as ProseNode } from '@milkdown/prose/model';

export type SuggestionAttrs = {
  id: string;
  oldText: string;
  newText: string;
  metadata?: Record<string, unknown> | null;
};

export type InsertSuggestionPayload = {
  id: string;
  from: number;
  to: number;
  newText: string;
  oldText?: string;
  metadata?: Record<string, unknown> | null;
};

export type SuggestionDecision = {
  id: string;
  accepted: boolean;
  oldText: string;
  newText: string;
};

export const InsertSuggestion = createCmdKey<InsertSuggestionPayload>('InsertSuggestion');
export const AcceptSuggestion = createCmdKey<string>('AcceptSuggestion');
export const RejectSuggestion = createCmdKey<string>('RejectSuggestion');
export const AcceptAllSuggestions = createCmdKey('AcceptAllSuggestions');
export const RejectAllSuggestions = createCmdKey('RejectAllSuggestions');

const agentSuggestionNode = $node('agentSuggestion', () => ({
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

const insertSuggestionCommand = $command<InsertSuggestionPayload, 'InsertSuggestion'>('InsertSuggestion', (ctx) => (payload) => {
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

const acceptSuggestionCommand = $command<string, 'AcceptSuggestion'>('AcceptSuggestion', (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.newText));
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
    }
    return found;
  };
});

const rejectSuggestionCommand = $command<string, 'RejectSuggestion'>('RejectSuggestion', (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.oldText));
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
    }
    return found;
  };
});

const acceptAllSuggestionsCommand = $command<void, 'AcceptAllSuggestions'>('AcceptAllSuggestions', (ctx) => () => {
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

const rejectAllSuggestionsCommand = $command<void, 'RejectAllSuggestions'>('RejectAllSuggestions', (ctx) => () => {
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

/**
 * Register the suggestion node and supporting commands.
 */
export const agentSuggestion = (): MilkdownPlugin[] => [
  agentSuggestionNode,
  insertSuggestionCommand,
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  acceptAllSuggestionsCommand,
  rejectAllSuggestionsCommand,
];

/**
 * Helper that forces the editor into read-only mode so only programmatic actions modify content.
 */
export const lockEditor = (ctx: Ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => false,
  }));
};

/**
 * Helper to unlock the editor for manual typing, e.g. for debugging.
 */
export const unlockEditor = (ctx: Ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => true,
  }));
};

export type SuggestionSnapshot = SuggestionAttrs & { pos: number };

/**
 * Collect all suggestions currently in the document.
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

/**
 * Utility to dispatch a suggestion insertion via Editor.action without importing command keys.
 */
export const insertSuggestion = (payload: InsertSuggestionPayload) => (ctx: Ctx) => {
  return insertSuggestionCommand.run(payload);
};

export const acceptSuggestion = (id: string) => (ctx: Ctx) => {
  return acceptSuggestionCommand.run(id);
};

export const rejectSuggestion = (id: string) => (ctx: Ctx) => {
  return rejectSuggestionCommand.run(id);
};

export const acceptAllSuggestions = () => (ctx: Ctx) => {
  return acceptAllSuggestionsCommand.run();
};

export const rejectAllSuggestions = () => (ctx: Ctx) => {
  return rejectAllSuggestionsCommand.run();
};
