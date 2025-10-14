import { useCallback, useEffect, useState } from 'react';
import { Editor, rootCtx, editorViewCtx } from '@milkdown/core';
import { MilkdownProvider, Milkdown, useEditor, useInstance } from '@milkdown/react';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { nanoid } from 'nanoid';
import {
  agentSuggestion,
  lockEditor,
  insertSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  collectSuggestions,
  type SuggestionSnapshot,
} from '@milkdown-agent/suggestion-plugin';

import './index.css';

const initialMarkdown = `# Agent Suggestion Playground

This demo keeps the Milkdown editor in review-only mode. Suggestions appear inline so reviewers can accept or reject them.

- rename this bullet
- leave another bullet alone

Below is a short paragraph the agent wants to adjust.`;

type DemoSuggestion = {
  id: string;
  search: string;
  newText: string;
  metadata?: Record<string, unknown>;
};

const demoSuggestions: DemoSuggestion[] = [
  {
    id: 'demo-1',
    search: 'keeps the Milkdown editor',
    newText: 'presents a review-only editor experience',
    metadata: { kind: 'tone' },
  },
  {
    id: 'demo-2',
    search: 'rename this bullet',
    newText: 'update this task label',
    metadata: { kind: 'task' },
  },
  {
    id: 'demo-3',
    search: 'short paragraph the agent wants to adjust',
    newText: 'brief paragraph that the agent has rewritten for clarity',
    metadata: { kind: 'rewrite' },
  },
];

type TextRange = { from: number; to: number };

const computeRanges = (doc: Parameters<typeof collectSuggestions>[0], search: string): TextRange | null => {
  let linearText = '';
  const indexToPos: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      linearText += node.text;
      for (let i = 0; i < node.text.length; i += 1) {
        indexToPos.push(pos + i);
      }
    }
    return true;
  });

  const start = linearText.indexOf(search);
  if (start < 0) return null;
  const endIndex = start + search.length - 1;
  const from = indexToPos[start];
  const endPos = indexToPos[endIndex];
  if (from == null || endPos == null) return null;
  return { from, to: endPos + 1 };
};

const DemoMilkdown = () => {
  useEditor(
    (root) =>
      Editor.make()
        .use(nord)
        .use(commonmark)
        .config((ctx) => {
          ctx.set(rootCtx, root);
          lockEditor(ctx);
        })
        .use(agentSuggestion()),
    [],
  );

  return <Milkdown />;
};

const SuggestionPanel = ({
  suggestions,
  onAccept,
  onReject,
}: {
  suggestions: SuggestionSnapshot[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  if (!suggestions.length) {
    return <p className="suggestion-panel__empty">No pending suggestions. Ask the agent for more edits!</p>;
  }

  return (
    <ul className="suggestion-panel__list">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="suggestion-panel__item">
          <div className="suggestion-panel__texts">
            <span className="suggestion-panel__old">{suggestion.oldText}</span>
            <span className="suggestion-panel__arrow">→</span>
            <span className="suggestion-panel__new">{suggestion.newText}</span>
          </div>
          <div className="suggestion-panel__actions">
            <button type="button" onClick={() => onReject(suggestion.id)}>
              Reject
            </button>
            <button type="button" className="primary" onClick={() => onAccept(suggestion.id)}>
              Accept
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const Playground = () => {
  const { editor } = useInstance();
  const [suggestions, setSuggestions] = useState<SuggestionSnapshot[]>([]);

  const refreshSuggestions = useCallback(() => {
    editor()?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setSuggestions(collectSuggestions(view.state.doc));
    });
  }, [editor]);

  const seedSuggestions = useCallback(() => {
    editor()?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const existingIds = new Set(collectSuggestions(state.doc).map((item) => item.id));
      const ranges = demoSuggestions
        .map((suggestion) => {
          if (existingIds.has(suggestion.id)) return null;
          const range = computeRanges(state.doc, suggestion.search);
          if (!range) return null;
          return { suggestion, range };
        })
        .filter((item): item is { suggestion: DemoSuggestion; range: TextRange } => Boolean(item))
        .sort((a, b) => b.range.from - a.range.from);

      ranges.forEach(({ suggestion, range }) => {
        insertSuggestion({
          id: suggestion.id ?? nanoid(),
          from: range.from,
          to: range.to,
          newText: suggestion.newText,
          oldText: state.doc.textBetween(range.from, range.to, '\n'),
          metadata: suggestion.metadata ?? null,
        })(ctx);
      });
    });
    refreshSuggestions();
  }, [editor, refreshSuggestions]);

  useEffect(() => {
    const instance = editor();
    if (!instance) return;
    instance.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      if (!state.doc.textBetween(0, state.doc.content.size, '\n').length) {
        const { tr } = state;
        tr.insertText(initialMarkdown, 0);
        dispatch(tr);
      }
    });
    seedSuggestions();
  }, [editor, seedSuggestions]);

  const accept = useCallback(
    (id: string) => {
      editor()?.action((ctx) => {
        acceptSuggestion(id)(ctx);
      });
      refreshSuggestions();
    },
    [editor, refreshSuggestions],
  );
  
  const reject = useCallback(
    (id: string) => {
      editor()?.action((ctx) => {
        rejectSuggestion(id)(ctx);
      });
      refreshSuggestions();
    },
    [editor, refreshSuggestions],
  );

  const reset = useCallback(() => {
    editor()?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const tr = state.tr;
      tr.delete(0, state.doc.content.size);
      tr.insertText(initialMarkdown, 0);
      dispatch(tr);
    });
    seedSuggestions();
  }, [editor, seedSuggestions]);

  return (
    <div className="app">
      <div className="editor-card">
        <div className="card-header">
          <h1>Agent Suggestion Playground</h1>
          <button type="button" onClick={reset}>
            Reset Demo
          </button>
        </div>
        <p className="card-subtitle">
          The editor below is locked for manual typing. Suggestions arrive programmatically and you decide what sticks.
        </p>
        <DemoMilkdown />
      </div>
      <aside className="suggestion-panel">
        <div className="card-header">
          <h2>Pending Suggestions</h2>
          <button type="button" onClick={seedSuggestions}>
            Recreate Suggestions
          </button>
        </div>
        <SuggestionPanel suggestions={suggestions} onAccept={accept} onReject={reject} />
      </aside>
    </div>
  );
};

const App = () => (
  <MilkdownProvider>
    <Playground />
  </MilkdownProvider>
);

export default App;
