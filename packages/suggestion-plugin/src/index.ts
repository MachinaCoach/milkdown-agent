import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import { commandsCtx, editorViewOptionsCtx } from '@milkdown/core';
import { createSlice } from '@milkdown/ctx';
import { $command, $node } from '@milkdown/utils';
import type { DOMOutputSpec, Node as ProseNode } from '@milkdown/prose/model';
import type { Command } from '@milkdown/prose/state';
import type { NodeView } from '@milkdown/prose/view';

export type SuggestionChangeType = 'insert' | 'remove' | 'replace';

const inferChangeType = (oldText: string, newText: string): SuggestionChangeType => {
  const hasOld = oldText.trim().length > 0;
  const hasNew = newText.trim().length > 0;
  if (!hasOld && hasNew) return 'insert';
  if (hasOld && !hasNew) return 'remove';
  return 'replace';
};

export type SuggestionAttrs = {
  id: string;
  oldText: string;
  newText: string;
  metadata?: Record<string, unknown> | null;
  changeType: SuggestionChangeType;
};

export type AgentSuggestionLabels = {
  accept: string;
  reject: string;
};

export type SuggestionDecisionSource = 'inline' | 'panel' | 'api';

export type SuggestionDecisionEvent = SuggestionDecision & {
  source: SuggestionDecisionSource;
};

export type SuggestionLifecycleEvent =
  | { type: 'insert'; suggestion: SuggestionAttrs }
  | { type: 'update'; suggestion: SuggestionAttrs }
  | { type: 'remove'; suggestion: SuggestionAttrs };

export type AgentSuggestionHandlers = {
  onDecision?: (event: SuggestionDecisionEvent) => void;
  onChange?: (event: SuggestionLifecycleEvent) => void;
};

export type AgentSuggestionOptions = {
  theme?: string;
  labels?: Partial<AgentSuggestionLabels>;
  handlers?: AgentSuggestionHandlers;
};

type ResolvedAgentSuggestionOptions = {
  theme: string;
  labels: AgentSuggestionLabels;
  handlers: AgentSuggestionHandlers;
};

const resolveOptions = (options?: AgentSuggestionOptions): ResolvedAgentSuggestionOptions => ({
  theme: options?.theme ?? 'default',
  labels: {
    accept: options?.labels?.accept ?? 'Approve',
    reject: options?.labels?.reject ?? 'Reject',
  },
  handlers: options?.handlers ?? {},
});

const agentSuggestionOptionsCtx = createSlice<ResolvedAgentSuggestionOptions>(
  resolveOptions(),
  'agentSuggestionOptionsCtx',
);

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

const emitLifecycleEvent = (ctx: Ctx, event: SuggestionLifecycleEvent) => {
  const { handlers } = ctx.get(agentSuggestionOptionsCtx);
  handlers?.onChange?.(event);
};

const emitDecisionEvent = (
  ctx: Ctx,
  decision: SuggestionDecision,
  source: SuggestionDecisionSource,
) => {
  const { handlers } = ctx.get(agentSuggestionOptionsCtx);
  handlers?.onDecision?.({ ...decision, source });
};

export type AcceptSuggestionPayload =
  | string
  | {
      id: string;
      source?: SuggestionDecisionSource;
    };

const normalizeDecisionPayload = (
  payload: AcceptSuggestionPayload | undefined,
): { id: string; source: SuggestionDecisionSource } | null => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return { id: payload, source: 'api' };
  }
  if (typeof payload === 'object' && typeof payload.id === 'string') {
    return { id: payload.id, source: payload.source ?? 'api' };
  }
  return null;
};

const suggestionNodeId = 'agentSuggestion';

const agentSuggestionNode = $node(suggestionNodeId, () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  attrs: {
    id: { default: '' },
    oldText: { default: '' },
    newText: { default: '' },
    metadata: { default: null },
    changeType: { default: 'replace' as SuggestionChangeType },
  },
  parseDOM: [
    {
      tag: 'span[data-agent-suggestion]',
      getAttrs: (dom) => {
        const element = dom as HTMLElement;
        const oldText =
          element.querySelector('[data-agent-suggestion-old]')?.textContent ?? '';
        const newText =
          element.querySelector('[data-agent-suggestion-new]')?.textContent ?? '';
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
          changeType:
            (element.getAttribute('data-agent-suggestion-change') as SuggestionChangeType | null) ??
            inferChangeType(oldText, newText),
        } satisfies SuggestionAttrs;
      },
    },
  ],
  toDOM: (node): DOMOutputSpec => {
    const { id, oldText, newText, metadata, changeType } = node.attrs as SuggestionAttrs;
    return [
      'span',
      {
        'data-agent-suggestion': 'true',
        'data-suggestion-id': id,
        'data-agent-suggestion-meta': metadata ? JSON.stringify(metadata) : undefined,
        'data-agent-suggestion-change': changeType,
        class: 'agent-suggestion',
      },
      ['span', { 'data-agent-suggestion-old': 'true', class: 'agent-suggestion__old' }, oldText],
      ['span', { 'data-agent-suggestion-new': 'true', class: 'agent-suggestion__new' }, newText],
    ];
  },
  parseMarkdown: {
    match: () => false,
    runner: () => undefined,
  },
  toMarkdown: {
    match: (node) => node.type.name === suggestionNodeId,
    runner: (state, node) => {
      const { newText } = node.attrs as SuggestionAttrs;
      state.addNode('text', undefined, newText);
    },
  },
}));

const insertCommandId = 'InsertSuggestion';
const acceptCommandId = 'AcceptSuggestion';
const rejectCommandId = 'RejectSuggestion';
const acceptAllCommandId = 'AcceptAllSuggestions';
const rejectAllCommandId = 'RejectAllSuggestions';
const updateCommandId = 'UpdateSuggestion';

const insertSuggestionCommand = $command<InsertSuggestionPayload | undefined, typeof insertCommandId>(
  insertCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return (payload): Command => {
      if (!payload) {
        return () => false;
      }
      return (state, dispatch) => {
        const { from, to, id, newText } = payload;
        if (!id) return false;
        const docSize = state.doc.content.size;
        if (from < 0 || to > docSize || from > to) return false;

        if (from === to) {
          const hasNew = newText.trim().length > 0;
          if (!hasNew) return false;
        }

        let duplicate = false;
        state.doc.descendants((node) => {
          if (node.type === nodeType) {
            const attrs = node.attrs as SuggestionAttrs;
            if (attrs.id === id) {
              duplicate = true;
              return false;
            }
          }
          return true;
        });
        if (duplicate) return false;

        const oldText = payload.oldText ?? state.doc.textBetween(from, to, '\n');
        const changeType = inferChangeType(oldText, newText);
        const suggestionAttrs: SuggestionAttrs = {
          id,
          oldText,
          newText,
          metadata: payload.metadata ?? null,
          changeType,
        };
        const suggestionNode = nodeType.create(suggestionAttrs);
        if (dispatch) {
          dispatch(state.tr.replaceWith(from, to, suggestionNode));
          emitLifecycleEvent(ctx, { type: 'insert', suggestion: suggestionAttrs });
        }
        return true;
      };
    };
  },
);

const acceptSuggestionCommand = $command<AcceptSuggestionPayload | undefined, typeof acceptCommandId>(
  acceptCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return (id): Command => {
      const normalized = normalizeDecisionPayload(id);
      if (!normalized) return () => false;
      return (state, dispatch) => {
        let found = false;
        const tr = state.tr;
        let decisionAttrs: SuggestionAttrs | null = null;
        state.doc.descendants((node, pos) => {
          if (node.type === nodeType) {
            const attrs = node.attrs as SuggestionAttrs;
            if (attrs.id === normalized.id) {
              found = true;
              decisionAttrs = attrs;
              if (attrs.changeType === 'remove') {
                tr.delete(pos, pos + node.nodeSize);
              } else {
                const replacementText = attrs.newText;
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(replacementText));
              }
              return false;
            }
          }
          return true;
        });
        if (found && dispatch) {
          dispatch(tr);
          if (decisionAttrs) {
            const decision: SuggestionAttrs = decisionAttrs;
            emitLifecycleEvent(ctx, { type: 'remove', suggestion: decision });
            emitDecisionEvent(
              ctx,
              { id: decision.id, accepted: true, oldText: decision.oldText, newText: decision.newText },
              normalized.source,
            );
          }
        }
        return found;
      };
    };
  },
);

const rejectSuggestionCommand = $command<AcceptSuggestionPayload | undefined, typeof rejectCommandId>(
  rejectCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return (id): Command => {
      const normalized = normalizeDecisionPayload(id);
      if (!normalized) return () => false;
      return (state, dispatch) => {
        let found = false;
        const tr = state.tr;
        let decisionAttrs: SuggestionAttrs | null = null;
        state.doc.descendants((node, pos) => {
          if (node.type === nodeType) {
            const attrs = node.attrs as SuggestionAttrs;
            if (attrs.id === normalized.id) {
              found = true;
              decisionAttrs = attrs;
              if (attrs.changeType === 'insert') {
                tr.delete(pos, pos + node.nodeSize);
              } else {
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(attrs.oldText));
              }
              return false;
            }
          }
          return true;
        });
        if (found && dispatch) {
          dispatch(tr);
          if (decisionAttrs) {
            const decision: SuggestionAttrs = decisionAttrs;
            emitLifecycleEvent(ctx, { type: 'remove', suggestion: decision });
            emitDecisionEvent(
              ctx,
              { id: decision.id, accepted: false, oldText: decision.oldText, newText: decision.newText },
              normalized.source,
            );
          }
        }
        return found;
      };
    };
  },
);

const acceptAllSuggestionsCommand = $command<undefined, typeof acceptAllCommandId>(
  acceptAllCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return () => (state, dispatch) => {
      let changed = false;
      const tr = state.tr;
      const decisions: SuggestionAttrs[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type === nodeType) {
          const attrs = node.attrs as SuggestionAttrs;
          changed = true;
          decisions.push(attrs);
          if (attrs.changeType === 'remove') {
            tr.delete(pos, pos + node.nodeSize);
          } else {
            tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(attrs.newText));
          }
          return false;
        }
        return true;
      });
      if (changed && dispatch) {
        dispatch(tr);
        decisions.forEach((attrs: SuggestionAttrs) => {
          emitLifecycleEvent(ctx, { type: 'remove', suggestion: attrs });
          emitDecisionEvent(ctx, { id: attrs.id, accepted: true, oldText: attrs.oldText, newText: attrs.newText }, 'api');
        });
      }
      return changed;
    };
  },
);

const rejectAllSuggestionsCommand = $command<undefined, typeof rejectAllCommandId>(
  rejectAllCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return () => (state, dispatch) => {
      let changed = false;
      const tr = state.tr;
      const decisions: SuggestionAttrs[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type === nodeType) {
          const attrs = node.attrs as SuggestionAttrs;
          changed = true;
          decisions.push(attrs);
          if (attrs.changeType === 'insert') {
            tr.delete(pos, pos + node.nodeSize);
          } else {
            tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(attrs.oldText));
          }
          return false;
        }
        return true;
      });
      if (changed && dispatch) {
        dispatch(tr);
        decisions.forEach((attrs: SuggestionAttrs) => {
          emitLifecycleEvent(ctx, { type: 'remove', suggestion: attrs });
          emitDecisionEvent(ctx, { id: attrs.id, accepted: false, oldText: attrs.oldText, newText: attrs.newText }, 'api');
        });
      }
      return changed;
    };
  },
);

export type UpdateSuggestionPayload = {
  id: string;
  newText?: string;
  metadata?: Record<string, unknown> | null;
};

const updateSuggestionCommand = $command<UpdateSuggestionPayload | undefined, typeof updateCommandId>(
  updateCommandId,
  (ctx) => {
    const nodeType = agentSuggestionNode.type(ctx);
    return (payload): Command => {
      if (!payload || !payload.id) return () => false;
      return (state, dispatch) => {
        let found = false;
        const tr = state.tr;
        let updatedSuggestion: SuggestionAttrs | null = null;
        state.doc.descendants((node, pos) => {
          if (node.type === nodeType) {
            const attrs = node.attrs as SuggestionAttrs;
            if (attrs.id === payload.id) {
              found = true;
              updatedSuggestion = {
                ...attrs,
                newText: payload.newText ?? attrs.newText,
                metadata:
                  payload.metadata !== undefined ? payload.metadata : attrs.metadata ?? null,
                changeType: inferChangeType(attrs.oldText, payload.newText ?? attrs.newText),
              };
              const replacement = nodeType.create(updatedSuggestion);
              tr.replaceWith(pos, pos + node.nodeSize, replacement);
              return false;
            }
          }
          return true;
        });
        if (found && dispatch) {
          dispatch(tr);
          if (updatedSuggestion) {
            emitLifecycleEvent(ctx, { type: 'update', suggestion: updatedSuggestion });
          }
        }
        return found;
      };
    };
  },
);

export const InsertSuggestion = insertSuggestionCommand.key;
export const AcceptSuggestion = acceptSuggestionCommand.key;
export const RejectSuggestion = rejectSuggestionCommand.key;
export const AcceptAllSuggestions = acceptAllSuggestionsCommand.key;
export const RejectAllSuggestions = rejectAllSuggestionsCommand.key;
export const UpdateSuggestion = updateSuggestionCommand.key;

/**
 * Register the suggestion node and supporting commands.
 */
class InlineSuggestionNodeView implements NodeView {
  dom: HTMLSpanElement;

  contentDOM = null;

  private oldTextDom: HTMLSpanElement;

  private newTextDom: HTMLSpanElement;

  private actionsDom: HTMLDivElement;

  private rejectButton: HTMLButtonElement;

  private acceptButton: HTMLButtonElement;

  private readonly handleMouseDown: (event: MouseEvent) => void;

  private readonly handleClick: (event: MouseEvent) => void;

  private readonly handleFocus: () => void;

  private readonly handleBlur: () => void;

  private readonly handleMouseEnter: () => void;

  private readonly handleMouseLeave: () => void;

  private readonly handleContainerMouseDown: () => void;

  constructor(
    private node: ProseNode,
    private ctx: Ctx,
    private options: ResolvedAgentSuggestionOptions,
  ) {
    this.dom = document.createElement('span');
    this.dom.className = 'agent-suggestion';
    this.dom.dataset.agentSuggestion = 'true';
    this.dom.setAttribute('data-agent-suggestion', 'true');
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.tabIndex = 0;

    this.oldTextDom = document.createElement('span');
    this.oldTextDom.className = 'agent-suggestion__old';
    this.oldTextDom.setAttribute('data-agent-suggestion-old', 'true');

    this.newTextDom = document.createElement('span');
    this.newTextDom.className = 'agent-suggestion__new';
    this.newTextDom.setAttribute('data-agent-suggestion-new', 'true');

    this.actionsDom = document.createElement('div');
    this.actionsDom.className = 'agent-suggestion__actions';

    this.rejectButton = document.createElement('button');
    this.rejectButton.type = 'button';
    this.rejectButton.className = 'agent-suggestion__action agent-suggestion__action--reject';
    this.rejectButton.textContent = this.options.labels.reject;
    this.rejectButton.setAttribute('aria-label', `${this.options.labels.reject} suggestion`);

    this.acceptButton = document.createElement('button');
    this.acceptButton.type = 'button';
    this.acceptButton.className = 'agent-suggestion__action agent-suggestion__action--accept';
    this.acceptButton.textContent = this.options.labels.accept;
    this.acceptButton.setAttribute('aria-label', `${this.options.labels.accept} suggestion`);

    this.actionsDom.append(this.rejectButton, this.acceptButton);

    this.handleMouseDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    this.handleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as HTMLElement;
      if (!target) return;
      if (target === this.acceptButton) {
        this.accept();
      } else if (target === this.rejectButton) {
        this.reject();
      }
    };

    this.handleFocus = () => {
      this.setActive(true);
    };

    this.handleBlur = () => {
      this.setActive(false);
    };

    this.handleMouseEnter = () => {
      this.setActive(true);
    };

    this.handleMouseLeave = () => {
      this.setActive(false);
    };

    this.handleContainerMouseDown = () => {
      this.setActive(true);
    };

    this.actionsDom.addEventListener('mousedown', this.handleMouseDown);
    this.actionsDom.addEventListener('click', this.handleClick);
    this.dom.addEventListener('focus', this.handleFocus);
    this.dom.addEventListener('blur', this.handleBlur);
    this.dom.addEventListener('mouseenter', this.handleMouseEnter);
    this.dom.addEventListener('mouseleave', this.handleMouseLeave);
    this.dom.addEventListener('mousedown', this.handleContainerMouseDown);

    this.dom.append(this.oldTextDom, this.newTextDom, this.actionsDom);
    this.render();
  }

  private setActive(active: boolean) {
    if (active) {
      this.dom.dataset.agentSuggestionActive = 'true';
      this.dom.classList.add('agent-suggestion--active');
    } else {
      delete this.dom.dataset.agentSuggestionActive;
      this.dom.classList.remove('agent-suggestion--active');
    }
  }

  private render() {
    const attrs = this.node.attrs as SuggestionAttrs;
    this.dom.dataset.suggestionId = attrs.id;
    this.dom.setAttribute('data-suggestion-id', attrs.id);
    this.dom.dataset.agentSuggestionChange = attrs.changeType;
    this.dom.setAttribute('data-agent-suggestion-change', attrs.changeType);
    this.dom.dataset.agentSuggestionTheme = this.options.theme;
    this.oldTextDom.textContent = attrs.oldText;
    this.newTextDom.textContent = attrs.newText;
    if (attrs.metadata) {
      try {
        const serialized = JSON.stringify(attrs.metadata);
        this.dom.dataset.agentSuggestionMeta = serialized;
        this.dom.setAttribute('data-agent-suggestion-meta', serialized);
      } catch (error) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
          console.warn('Unable to serialize suggestion metadata', error);
        }
      }
    } else {
      delete this.dom.dataset.agentSuggestionMeta;
      this.dom.removeAttribute('data-agent-suggestion-meta');
    }
  }

  update(node: ProseNode) {
    this.node = node;
    this.render();
    return true;
  }

  selectNode() {
    this.dom.classList.add('agent-suggestion--selected');
  }

  deselectNode() {
    this.dom.classList.remove('agent-suggestion--selected');
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    this.actionsDom.removeEventListener('mousedown', this.handleMouseDown);
    this.actionsDom.removeEventListener('click', this.handleClick);
    this.dom.removeEventListener('focus', this.handleFocus);
    this.dom.removeEventListener('blur', this.handleBlur);
    this.dom.removeEventListener('mouseenter', this.handleMouseEnter);
    this.dom.removeEventListener('mouseleave', this.handleMouseLeave);
    this.dom.removeEventListener('mousedown', this.handleContainerMouseDown);
  }

  private accept() {
    const attrs = this.node.attrs as SuggestionAttrs;
    this.ctx.get(commandsCtx).call(acceptCommandId, { id: attrs.id, source: 'inline' });
  }

  private reject() {
    const attrs = this.node.attrs as SuggestionAttrs;
    this.ctx.get(commandsCtx).call(rejectCommandId, { id: attrs.id, source: 'inline' });
  }
}

const configureSuggestionOptions = (options: ResolvedAgentSuggestionOptions): MilkdownPlugin => (ctx) => {
  ctx.set(agentSuggestionOptionsCtx, options);
  return () => {
    ctx.set(agentSuggestionOptionsCtx, resolveOptions());
  };
};

const suggestionNodeViewPlugin = (): MilkdownPlugin =>
  (ctx) => {
    const viewFactory = (node: ProseNode) => new InlineSuggestionNodeView(node, ctx, ctx.get(agentSuggestionOptionsCtx));

    ctx.update(editorViewOptionsCtx, (prev) => ({
      ...prev,
      nodeViews: {
        ...(prev.nodeViews ?? {}),
        [suggestionNodeId]: viewFactory,
      },
    }));

    return () => {
      ctx.update(editorViewOptionsCtx, (prev) => {
        if (!prev.nodeViews || prev.nodeViews[suggestionNodeId] !== viewFactory) {
          return prev;
        }
        const { [suggestionNodeId]: _removed, ...rest } = prev.nodeViews;
        return {
          ...prev,
          nodeViews: rest,
        };
      });
    };
  };

export const agentSuggestion = (options?: AgentSuggestionOptions): MilkdownPlugin[] => {
  const resolved = resolveOptions(options);
  return [
    configureSuggestionOptions(resolved),
    agentSuggestionNode,
    insertSuggestionCommand,
    acceptSuggestionCommand,
    rejectSuggestionCommand,
    acceptAllSuggestionsCommand,
    rejectAllSuggestionsCommand,
    updateSuggestionCommand,
    suggestionNodeViewPlugin(),
  ];
};

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
    if (node.type.name === suggestionNodeId) {
      const attrs = node.attrs as SuggestionAttrs;
      results.push({
        id: attrs.id,
        oldText: attrs.oldText,
        newText: attrs.newText,
        metadata: attrs.metadata,
        changeType: attrs.changeType,
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
  ctx.get(commandsCtx).call(insertCommandId, payload);
};

export const acceptSuggestion = (payload: AcceptSuggestionPayload) => (ctx: Ctx) => {
  ctx.get(commandsCtx).call(acceptCommandId, payload);
};

export const rejectSuggestion = (payload: AcceptSuggestionPayload) => (ctx: Ctx) => {
  ctx.get(commandsCtx).call(rejectCommandId, payload);
};

export const acceptAllSuggestions = () => (ctx: Ctx) => {
  ctx.get(commandsCtx).call(acceptAllCommandId);
};

export const rejectAllSuggestions = () => (ctx: Ctx) => {
  ctx.get(commandsCtx).call(rejectAllCommandId);
};

export const updateSuggestion = (payload: UpdateSuggestionPayload) => (ctx: Ctx) => {
  ctx.get(commandsCtx).call(updateCommandId, payload);
};
