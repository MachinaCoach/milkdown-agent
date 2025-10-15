import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type { Ctx } from '@milkdown/ctx';
import { Editor, rootCtx, editorViewCtx, parserCtx, defaultValueCtx } from '@milkdown/core';
import { MilkdownProvider, Milkdown, useEditor, useInstance } from '@milkdown/react';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { nanoid } from 'nanoid';
import type { Transaction } from '@milkdown/prose/state';
import {
  agentSuggestion,
  insertSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  updateSuggestion,
  collectSuggestions,
  type SuggestionSnapshot,
  type AgentSuggestionLabels,
  type SuggestionLifecycleEvent,
  type SuggestionDecisionEvent,
} from '@milkdown-agent/suggestion-plugin';

import './index.css';

const initialMarkdown = `# Agent Suggestion Playground Demo

Welcome to the interactive test harness showcasing WYSIWYG suggestions from agents.

## Headings

### Subheading Example

#### Tiny heading

## Formatting

We can render **bold**, _italic_, ~~strikethrough~~, and [links](https://milkdown.dev). Inline code like \`const sum = 1 + 2;\` keeps formatting.

> Quoted text from the agent for context.

---

## Lists

- rename this bullet
- remove this obsolete bullet
- keep this bullet the same

1. Ordered first item
2. Ordered second item

- [ ] Checkbox unchecked
- [x] Checkbox finished

## Table

| Syntax | Purpose |
| ------ | ------- |
| Table row | holds structured data |

## Code Block

\`\`\`ts
function greet(name: string) {
  return \`Hello, ${name}!\`;
}
\`\`\`

## Final Paragraph

This section stays static so you can experiment with manual edits alongside the suggestions.
`;

type ReplaceSuggestion = {
  id: string;
  type: 'replace';
  search: string;
  newText: string;
  metadata?: Record<string, unknown>;
};

type RemoveSuggestion = {
  id: string;
  type: 'remove';
  search: string;
  metadata?: Record<string, unknown>;
};

type AppendSuggestion = {
  id: string;
  type: 'append';
  search: string;
  newText: string;
  metadata?: Record<string, unknown>;
};

type DemoSuggestion = ReplaceSuggestion | RemoveSuggestion | AppendSuggestion;

const demoSuggestions: DemoSuggestion[] = [
  {
    id: 'demo-heading',
    type: 'replace',
    search: 'Agent Suggestion Playground Demo',
    newText: 'Agent Suggestion Playground Showcase',
    metadata: { kind: 'heading', target: 'H1 title' },
  },
  {
    id: 'demo-headings-section',
    type: 'replace',
    search: 'Headings',
    newText: 'Headings & Structure',
    metadata: { kind: 'heading', target: 'H2 section' },
  },
  {
    id: 'demo-subheading',
    type: 'replace',
    search: 'Subheading Example',
    newText: 'Subheading Demonstration',
    metadata: { kind: 'heading', target: 'H3 section' },
  },
  {
    id: 'demo-small-heading',
    type: 'replace',
    search: 'Tiny heading',
    newText: 'Fine-grained heading',
    metadata: { kind: 'heading', target: 'H4 section' },
  },
  {
    id: 'demo-bold',
    type: 'replace',
    search: 'bold',
    newText: 'strong text',
    metadata: { kind: 'formatting', target: 'bold text' },
  },
  {
    id: 'demo-italic',
    type: 'replace',
    search: 'italic',
    newText: 'emphasized copy',
    metadata: { kind: 'formatting', target: 'italic text' },
  },
  {
    id: 'demo-strike',
    type: 'replace',
    search: 'strikethrough',
    newText: 'revision history',
    metadata: { kind: 'formatting', target: 'strikethrough text' },
  },
  {
    id: 'demo-link',
    type: 'replace',
    search: 'links',
    newText: 'hyperlinks',
    metadata: { kind: 'formatting', target: 'link label' },
  },
  {
    id: 'demo-inline-code',
    type: 'replace',
    search: 'const sum = 1 + 2;',
    newText: 'const sum = 2 + 2;',
    metadata: { kind: 'code', target: 'inline code' },
  },
  {
    id: 'demo-quote-append',
    type: 'append',
    search: 'Quoted text from the agent for context.',
    newText: ' Additional note from the agent to review inline actions.',
    metadata: { kind: 'blockquote', target: 'quote' },
  },
  {
    id: 'demo-remove-bullet',
    type: 'remove',
    search: 'remove this obsolete bullet',
    metadata: { kind: 'list', target: 'list item removal' },
  },
  {
    id: 'demo-rename-bullet',
    type: 'replace',
    search: 'rename this bullet',
    newText: 'retitle this checklist item',
    metadata: { kind: 'list', target: 'bullet rename' },
  },
  {
    id: 'demo-ordered',
    type: 'replace',
    search: 'Ordered second item',
    newText: 'Ordered follow-up action',
    metadata: { kind: 'list', target: 'ordered item' },
  },
  {
    id: 'demo-checkbox',
    type: 'replace',
    search: 'Checkbox unchecked',
    newText: 'Checkbox pending review',
    metadata: { kind: 'list', target: 'task item' },
  },
  {
    id: 'demo-table',
    type: 'replace',
    search: 'Table row',
    newText: 'Sample row',
    metadata: { kind: 'table', target: 'table cell' },
  },
  {
    id: 'demo-code-block',
    type: 'replace',
    search: 'return `Hello, ${name}!`;',
    newText: 'return `Hi, ${name}!`;',
    metadata: { kind: 'code', target: 'code block' },
  },
  {
    id: 'demo-append-paragraph',
    type: 'append',
    search:
      'This section stays static so you can experiment with manual edits alongside the suggestions.',
    newText:
      ' Feel free to modify surrounding prose before accepting to simulate reviewer collaboration.',
    metadata: { kind: 'paragraph', target: 'closing paragraph' },
  },
];

type TextRange = { from: number; to: number };

type SuggestionOperation = {
  suggestion: DemoSuggestion;
  from: number;
  to: number;
  newText: string;
  oldText: string;
};

type EventLogEntry = {
  key: string;
  kind: 'change' | 'decision';
  summary: string;
  meta: string;
  timestamp: number;
};

const computeRanges = (doc: Parameters<typeof collectSuggestions>[0], search: string): TextRange | null => {
  let result: TextRange | null = null;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const index = node.text.indexOf(search);
    if (index < 0) return true;
    const from = pos + index;
    result = { from, to: from + search.length };
    return false;
  });

  return result;
};

const DemoMilkdown = ({
  suggestionTheme,
  actionLabels,
  onLifecycleEvent,
  onDecisionEvent,
}: {
  suggestionTheme: string;
  actionLabels?: Partial<AgentSuggestionLabels>;
  onLifecycleEvent?: (event: SuggestionLifecycleEvent) => void;
  onDecisionEvent?: (event: SuggestionDecisionEvent) => void;
}) => {
  const acceptLabel = actionLabels?.accept;
  const rejectLabel = actionLabels?.reject;

  useEditor(
    (root) =>
      Editor.make()
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialMarkdown);
        })
        .use(
          agentSuggestion({
            theme: suggestionTheme,
            labels: actionLabels,
            handlers: {
              onChange: onLifecycleEvent,
              onDecision: onDecisionEvent,
            },
          }),
        ),
    [suggestionTheme, acceptLabel, rejectLabel, onLifecycleEvent, onDecisionEvent],
  );

  return (
    <div className="milkdown-surface">
      <Milkdown />
    </div>
  );
};

const getChangeLabel = (changeType: SuggestionSnapshot['changeType']) => {
  switch (changeType) {
    case 'insert':
      return 'Append';
    case 'remove':
      return 'Remove';
    default:
      return 'Rewrite';
  }
};

const SuggestionPanel = ({
  suggestions,
  onAccept,
  onReject,
  onModify,
}: {
  suggestions: SuggestionSnapshot[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string, newText: string) => void;
}) => {
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setEditing((current) => (current ? { ...current, draft: next } : current));
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>, snapshot: SuggestionSnapshot) => {
    event.preventDefault();
    if (!editing || editing.id !== snapshot.id) return;
    if (editing.draft === snapshot.newText) {
      setEditing(null);
      return;
    }
    onModify(snapshot.id, editing.draft);
    setEditing(null);
  };

  if (!suggestions.length) {
    return <p className="suggestion-panel__empty">No pending suggestions. Ask the agent for more edits!</p>;
  }

  return (
    <ul className="suggestion-panel__list">
      {suggestions.map((suggestion) => {
        const metadataTags: string[] = [];
        if (suggestion.metadata && typeof suggestion.metadata === 'object') {
          Object.entries(suggestion.metadata as Record<string, unknown>).forEach(([key, value]) => {
            if (typeof value === 'string') {
              metadataTags.push(`${key}: ${value}`);
            }
          });
        }

        const isEditing = editing?.id === suggestion.id;
        const canModify = suggestion.changeType !== 'remove';
        const draftText = isEditing ? editing?.draft ?? suggestion.newText : suggestion.newText;

        return (
          <li key={suggestion.id} className="suggestion-panel__item">
            <div className="suggestion-panel__summary">
              <span className={`suggestion-panel__chip suggestion-panel__chip--${suggestion.changeType}`}>
                {getChangeLabel(suggestion.changeType)}
              </span>
              {metadataTags.length > 0 && (
                <div className="suggestion-panel__meta-chips">
                  {metadataTags.map((tag) => (
                    <code key={tag} className="suggestion-panel__chip-meta">
                      {tag}
                    </code>
                  ))}
                </div>
              )}
            </div>
            <div className="suggestion-panel__texts">
              {suggestion.changeType !== 'insert' && (
                <span className="suggestion-panel__old">{suggestion.oldText}</span>
              )}
              {suggestion.changeType === 'replace' && <span className="suggestion-panel__arrow">→</span>}
              {suggestion.changeType !== 'remove' && (
                <span className="suggestion-panel__new">{suggestion.newText}</span>
              )}
            </div>
            <div className="suggestion-panel__actions">
              <button type="button" onClick={() => onReject(suggestion.id)}>
                Reject
              </button>
              <button type="button" className="primary" onClick={() => onAccept(suggestion.id)}>
                Approve
              </button>
            </div>
            {canModify && (
              <div className="suggestion-panel__editor">
                {isEditing ? (
                  <form onSubmit={(event) => submitEdit(event, suggestion)} className="suggestion-panel__editor-form">
                    <label htmlFor={`draft-${suggestion.id}`}>Modify proposed text</label>
                    <textarea
                      id={`draft-${suggestion.id}`}
                      value={draftText}
                      onChange={handleDraftChange}
                      rows={3}
                    />
                    <div className="suggestion-panel__editor-actions">
                      <button type="button" onClick={cancelEditing}>
                        Cancel
                      </button>
                      <button type="submit" className="primary">
                        Save update
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="secondary" onClick={() => setEditing({ id: suggestion.id, draft: draftText })}>
                    Modify suggestion text
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const EventTimeline = ({
  events,
  onClear,
}: {
  events: EventLogEntry[];
  onClear: () => void;
}) => {
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  );

  return (
    <div className="event-timeline">
      <div className="event-timeline__header">
        <h3>Suggestion Events</h3>
        <button type="button" onClick={onClear} disabled={!events.length}>
          Clear log
        </button>
      </div>
      {events.length === 0 ? (
        <p className="event-timeline__empty">Interact with the editor to stream suggestion lifecycle updates.</p>
      ) : (
        <ul className="event-timeline__list">
          {events.map((event) => (
            <li key={event.key} className="event-timeline__item">
              <span className={`event-timeline__badge event-timeline__badge--${event.kind}`}>
                {event.kind === 'change' ? 'Change' : 'Decision'}
              </span>
              <div className="event-timeline__details">
                <span className="event-timeline__summary">{event.summary}</span>
                <div className="event-timeline__meta">
                  <span>{event.meta}</span>
                  <time dateTime={new Date(event.timestamp).toISOString()}>{timeFormatter.format(event.timestamp)}</time>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

type PlaygroundProps = {
  title: string;
  subtitle: string;
  suggestionTheme: string;
  actionLabels?: Partial<AgentSuggestionLabels>;
  showPanel?: boolean;
  showMixedModeButton?: boolean;
  hintTitle?: string;
  hintDescription?: string;
  showEventLog?: boolean;
};

const Playground = ({
  title,
  subtitle,
  suggestionTheme,
  actionLabels,
  showPanel = false,
  showMixedModeButton = false,
  hintTitle,
  hintDescription,
  showEventLog = false,
}: PlaygroundProps) => {
  const instance = useInstance();
  const isLoading = instance[0];
  const getEditor = instance[1];
  const [suggestions, setSuggestions] = useState<SuggestionSnapshot[]>([]);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const hasBootstrapped = useRef(false);
  const initialFocusDone = useRef(false);
  const metadataLookup = useMemo(() => {
    const map = new Map<string, Record<string, unknown> | null>();
    demoSuggestions.forEach((item) => {
      map.set(item.id, item.metadata ?? null);
    });
    return map;
  }, []);
  const paletteLabel = suggestionTheme === 'default' ? 'Default diff theme' : `“${suggestionTheme}” diff theme`;

  const inlineLabels = useMemo(
    () => ({
      accept: actionLabels?.accept ?? 'Approve',
      reject: actionLabels?.reject ?? 'Reject',
    }),
    [actionLabels?.accept, actionLabels?.reject],
  );

  const formatSnippet = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '∅';
    if (trimmed.length > 80) {
      return `“${trimmed.slice(0, 77)}…”`;
    }
    return `“${trimmed}”`;
  }, []);

  const getTargetLabel = useCallback(
    (id: string, metadata?: Record<string, unknown> | null) => {
      const meta = metadata ?? metadataLookup.get(id) ?? null;
      if (meta && typeof meta === 'object') {
        const target = (meta as Record<string, unknown>).target;
        if (typeof target === 'string') {
          return target;
        }
      }
      return id;
    },
    [metadataLookup],
  );

  const pushEvent = useCallback(
    (entry: { kind: EventLogEntry['kind']; summary: string; meta: string }) => {
      const event: EventLogEntry = {
        key: nanoid(),
        kind: entry.kind,
        summary: entry.summary,
        meta: entry.meta,
        timestamp: Date.now(),
      };
      setEvents((prev) => [event, ...prev].slice(0, 20));
    },
    [],
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const handleLifecycleEvent = useCallback(
    (event: SuggestionLifecycleEvent) => {
      const target = getTargetLabel(event.suggestion.id, event.suggestion.metadata);
      const verb = event.type === 'insert' ? 'Inserted' : event.type === 'update' ? 'Updated' : 'Removed';
      let detail: string;
      if (event.type === 'remove') {
        detail = `Restored ${formatSnippet(event.suggestion.oldText)}`;
      } else if (event.type === 'insert') {
        detail = `Proposed ${formatSnippet(event.suggestion.newText)}`;
      } else {
        detail = `Revised to ${formatSnippet(event.suggestion.newText)}`;
      }
      pushEvent({
        kind: 'change',
        summary: `${verb} ${target}`,
        meta: `${event.suggestion.changeType} · ${detail}`,
      });
    },
    [formatSnippet, getTargetLabel, pushEvent],
  );

  const handleDecisionEvent = useCallback(
    (event: SuggestionDecisionEvent) => {
      const target = getTargetLabel(event.id);
      const verb = event.accepted ? 'Approved' : 'Rejected';
      const sourceLabel =
        event.source === 'inline' ? 'inline controls' : event.source === 'panel' ? 'review panel' : 'API';
      const detail = event.accepted
        ? `Merged ${formatSnippet(event.newText)}`
        : `Restored ${formatSnippet(event.oldText)}`;
      pushEvent({
        kind: 'decision',
        summary: `${verb} ${target}`,
        meta: `${sourceLabel} · ${detail}`,
      });
    },
    [formatSnippet, getTargetLabel, pushEvent],
  );

  const runWithEditor = useCallback(
    (runner: (ctx: Ctx) => void) => {
      if (isLoading) return;
      const editor = getEditor();
      editor?.action(runner);
    },
    [getEditor, isLoading],
  );

  const updateSuggestions = useCallback((ctx: Ctx) => {
    const view = ctx.get(editorViewCtx);
    setSuggestions(collectSuggestions(view.state.doc));
  }, []);

  const applySeedSuggestions = useCallback(
    (ctx: Ctx) => {
      initialFocusDone.current = false;
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const existingIds = new Set(collectSuggestions(state.doc).map((item) => item.id));
      const operations: SuggestionOperation[] = [];
      const missing: DemoSuggestion[] = [];

      demoSuggestions.forEach((suggestionConfig) => {
        if (existingIds.has(suggestionConfig.id)) return;
        const anchor = computeRanges(state.doc, suggestionConfig.search);
        if (!anchor) {
          missing.push(suggestionConfig);
          return;
        }

        if (suggestionConfig.type === 'append') {
          operations.push({
            suggestion: suggestionConfig,
            from: anchor.to,
            to: anchor.to,
            newText: suggestionConfig.newText,
            oldText: '',
          });
          return;
        }

        const newText = suggestionConfig.type === 'remove' ? '' : suggestionConfig.newText;
        const oldText = state.doc.textBetween(anchor.from, anchor.to, '\n');

        operations.push({
          suggestion: suggestionConfig,
          from: anchor.from,
          to: anchor.to,
          newText,
          oldText,
        });
      });

      operations
        .sort((a, b) => b.from - a.from)
        .forEach(({ suggestion: config, from, to, newText, oldText }) => {
          const suggestionId = config.id ?? nanoid();
          if (!metadataLookup.has(suggestionId)) {
            metadataLookup.set(suggestionId, config.metadata ?? null);
          }
          insertSuggestion({
            id: suggestionId,
            from,
            to,
            newText,
            oldText,
            metadata: config.metadata ?? null,
          })(ctx);
        });

      updateSuggestions(ctx);

      if (missing.length) {
        missing.forEach((missed) => {
          pushEvent({
            kind: 'change',
            summary: `Skipped ${missed.id}`,
            meta: 'Original anchor text no longer present in the document.',
          });
        });
      }
    },
    [metadataLookup, pushEvent, updateSuggestions],
  );

  useEffect(() => {
    if (isLoading || hasBootstrapped.current) return;
    runWithEditor((ctx) => {
      const view = ctx.get(editorViewCtx);
      const parser = ctx.get(parserCtx);
      const parsed = parser(initialMarkdown);
      const { state, dispatch } = view;
      if (parsed) {
        const tr = state.tr.replaceWith(0, state.doc.content.size, parsed.content);
        dispatch(tr);
      }
      applySeedSuggestions(ctx);
    });
    hasBootstrapped.current = true;
  }, [applySeedSuggestions, isLoading, runWithEditor]);

  useEffect(() => {
    if (isLoading) return;
    let cleanup: (() => void) | undefined;
    runWithEditor((ctx) => {
      const view = ctx.get(editorViewCtx);
      const originalDispatch = view.dispatch.bind(view);
      view.dispatch = (tr: Transaction) => {
        originalDispatch(tr);
        setSuggestions(collectSuggestions(view.state.doc));
      };
      cleanup = () => {
        view.dispatch = originalDispatch;
      };
    });
    return cleanup;
  }, [isLoading, runWithEditor]);

  useEffect(() => {
    if (!suggestions.length) {
      initialFocusDone.current = false;
      return;
    }
    if (initialFocusDone.current) return;
    const first = suggestions[0];
    const element = document.querySelector<HTMLElement>(`[data-suggestion-id="${first.id}"]`);
    if (element) {
      element.focus();
      initialFocusDone.current = true;
    }
  }, [suggestions]);

  const seedSuggestions = useCallback(() => {
    runWithEditor(applySeedSuggestions);
  }, [applySeedSuggestions, runWithEditor]);

  const accept = useCallback(
    (id: string) => {
      runWithEditor((ctx) => {
        acceptSuggestion({ id, source: 'panel' })(ctx);
        updateSuggestions(ctx);
      });
    },
    [runWithEditor, updateSuggestions],
  );

  const reject = useCallback(
    (id: string) => {
      runWithEditor((ctx) => {
        rejectSuggestion({ id, source: 'panel' })(ctx);
        updateSuggestions(ctx);
      });
    },
    [runWithEditor, updateSuggestions],
  );

  const modify = useCallback(
    (id: string, newText: string) => {
      runWithEditor((ctx) => {
        updateSuggestion({ id, newText })(ctx);
        updateSuggestions(ctx);
      });
    },
    [runWithEditor, updateSuggestions],
  );

  const reset = useCallback(() => {
    runWithEditor((ctx) => {
      initialFocusDone.current = false;
      const view = ctx.get(editorViewCtx);
      const parser = ctx.get(parserCtx);
      const { state, dispatch } = view;
      const parsed = parser(initialMarkdown);
      if (parsed) {
        const tr = state.tr.replaceWith(0, state.doc.content.size, parsed.content);
        dispatch(tr);
      }
      applySeedSuggestions(ctx);
    });
  }, [applySeedSuggestions, runWithEditor]);

  const mixedMode = useCallback(() => {
    runWithEditor((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      let tr = state.tr;
      const snapshots = collectSuggestions(state.doc);
      if (snapshots.length) {
        const primary = snapshots[0];
        const node = state.doc.nodeAt(primary.pos);
        if (node) {
          const afterPos = primary.pos + node.nodeSize;
          tr = tr.insertText(' ← reviewer tweak', afterPos);
          tr = tr.insertText('Reviewer note → ', primary.pos);
        }
      }
      const manualMarker = 'Reviewer manually added this paragraph while suggestions stay anchored.';
      if (!tr.doc.textBetween(0, tr.doc.content.size, '\n').includes(manualMarker)) {
        tr = tr.insertText(`\n\n${manualMarker}\n`, tr.doc.content.size);
      }
      dispatch(tr);
      updateSuggestions(ctx);
    });
  }, [runWithEditor, updateSuggestions]);

  return (
    <div className={`playground ${showPanel ? 'playground--with-panel' : 'playground--single'}`}>
        <div className="editor-card">
          <div className="card-header">
            <div className="card-header__title">
              <h1>{title}</h1>
              <span className="card-header__badge">{paletteLabel}</span>
            </div>
            <div className="card-header__actions">
              {showMixedModeButton && (
                <button type="button" className="secondary" onClick={mixedMode} disabled={isLoading}>
                  Simulate Mixed Mode
                </button>
              )}
              <button type="button" onClick={reset} disabled={isLoading}>
                Reset Demo
              </button>
            </div>
        </div>
        <p className="card-subtitle">{subtitle}</p>
        <DemoMilkdown
          suggestionTheme={suggestionTheme}
          actionLabels={actionLabels}
          onLifecycleEvent={handleLifecycleEvent}
          onDecisionEvent={handleDecisionEvent}
        />
        <div className="editor-footer">
          <span>
            {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'} inline
          </span>
          {!showPanel && (
            <button type="button" onClick={seedSuggestions} disabled={isLoading}>
              Refresh Suggestions
            </button>
          )}
        </div>
        {!showPanel && (
          <p className="editor-hint">
            Click or hover any highlighted change to approve (“{inlineLabels.accept}”) or reject (“{inlineLabels.reject}”) it using the inline controls.
          </p>
        )}
      </div>
      {showPanel ? (
        <aside className="suggestion-panel">
          <div className="card-header card-header--stacked">
            <div>
              <h2>Pending Suggestions</h2>
              <p className="card-subtitle suggestion-panel__subtitle">
                {suggestions.length
                  ? `Review ${suggestions.length} contextual ${suggestions.length === 1 ? 'change' : 'changes'} from the agent.`
                  : 'All caught up—reseed to review the sample set again.'}
              </p>
            </div>
            <button type="button" onClick={seedSuggestions} disabled={isLoading}>
              Recreate Suggestions
            </button>
          </div>
          <SuggestionPanel suggestions={suggestions} onAccept={accept} onReject={reject} onModify={modify} />
          {showEventLog && <EventTimeline events={events} onClear={clearEvents} />}
        </aside>
      ) : (
        <div className="suggestion-hint">
          <h2>{hintTitle ?? 'Alternate palette preview'}</h2>
          <p>
            {hintDescription ??
              'This mirrored editor instance shows the “sunset” palette applied only to inline suggestions—perfect for OSS adopters who want to restyle diff markers without touching the host editor.'}
          </p>
          <button type="button" onClick={seedSuggestions} disabled={isLoading}>
            Reseed Suggestions
          </button>
        </div>
      )}
    </div>
  );
};

const App = () => (
  <div className="page">
    <MilkdownProvider>
      <Playground
        title="Agent Suggestion Playground Demo"
        subtitle="Review agent-suggested heading, list, and paragraph updates in a fully editable Milkdown surface."
        suggestionTheme="default"
        showPanel
        showMixedModeButton
        showEventLog
      />
    </MilkdownProvider>
    <MilkdownProvider>
      <Playground
        title="Theme Showcase"
        subtitle="The mirrored document uses the warm “sunset” palette exclusively for inline diff rendering."
        suggestionTheme="sunset"
        actionLabels={{ accept: 'Apply', reject: 'Dismiss' }}
        hintTitle="Sunset palette in action"
        hintDescription="Hover the highlights to see the alternate palette and localized button copy. The underlying editor chrome stays untouched."
      />
    </MilkdownProvider>
  </div>
);

export default App;
