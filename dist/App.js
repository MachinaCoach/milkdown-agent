import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Editor, rootCtx, editorViewCtx, defaultValueCtx } from '@milkdown/core';
import { MilkdownProvider, Milkdown, useEditor, useInstance } from '@milkdown/react';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import '@milkdown/theme-nord/style.css';
import { nanoid } from 'nanoid';
import { agentSuggestion, lockEditor, insertSuggestion, acceptSuggestion, rejectSuggestion, collectSuggestions, } from '@milkdown-agent/suggestion-plugin';
import './index.css';
const initialMarkdown = `# Agent Suggestion Playground

Welcome to the **Milkdown Agent Plugin** demo! This editor showcases how AI agents can suggest changes to markdown documents.

## Features

- **Inline suggestions** with accept/reject controls
- **Change tracking** for user edits
- **Comprehensive markdown** support

## Text Formatting Examples

This paragraph demonstrates *italic text*, **bold text**, and \`inline code\` for various formatting options.

## Lists

### Unordered List
- First item with some content
- Second item that could be modified
- Third item to demonstrate deletions

### Ordered List
1. Step one in the process
2. Step two needs clarification
3. Step three is optional

## Links and Code

Check out the [Milkdown documentation](https://milkdown.dev) for more information.

Here's a code block example:

\`\`\`typescript
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Blockquotes

> This is a quote that might need editing.
> It spans multiple lines.

---

## Summary

This playground demonstrates agent-driven editing with full markdown support.`;
const demoSuggestions = [
    // CHANGE: Modify text formatting
    {
        id: 'change-1',
        search: 'This paragraph demonstrates',
        newText: 'This example showcases',
        metadata: { operation: 'CHANGE', element: 'text' },
    },
    // CHANGE: Update list item
    {
        id: 'change-2',
        search: 'Second item that could be modified',
        newText: 'Second item with improved wording',
        metadata: { operation: 'CHANGE', element: 'list-item' },
    },
    // REMOVE: Delete list item (replace with empty)
    {
        id: 'remove-1',
        search: 'Third item to demonstrate deletions',
        newText: '',
        metadata: { operation: 'REMOVE', element: 'list-item' },
    },
    // CHANGE: Update ordered list item
    {
        id: 'change-3',
        search: 'Step two needs clarification',
        newText: 'Step two with clear instructions',
        metadata: { operation: 'CHANGE', element: 'ordered-list' },
    },
    // CHANGE: Update link text
    {
        id: 'change-4',
        search: 'Milkdown documentation',
        newText: 'official Milkdown docs',
        metadata: { operation: 'CHANGE', element: 'link' },
    },
    // CHANGE: Modify blockquote
    {
        id: 'change-5',
        search: 'This is a quote that might need editing.',
        newText: 'This is an improved quote with better clarity.',
        metadata: { operation: 'CHANGE', element: 'blockquote' },
    },
    // CHANGE: Update summary
    {
        id: 'change-6',
        search: 'agent-driven editing',
        newText: 'AI-powered collaborative editing',
        metadata: { operation: 'CHANGE', element: 'text' },
    },
];
const computeRanges = (doc, search) => {
    let linearText = '';
    const indexToPos = [];
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
    if (start < 0)
        return null;
    const endIndex = start + search.length - 1;
    const from = indexToPos[start];
    const endPos = indexToPos[endIndex];
    if (from == null || endPos == null)
        return null;
    return { from, to: endPos + 1 };
};
const DemoMilkdown = ({ onSuggestionsChanged }) => {
    useEditor((root) => Editor.make()
        .use(nord)
        .use(commonmark)
        .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialMarkdown);
    })
        .config(lockEditor)
        .use(agentSuggestion({
        onSuggestionAccepted: (suggestion) => {
            console.log('Suggestion accepted:', suggestion);
        },
        onSuggestionRejected: (suggestion) => {
            console.log('Suggestion rejected:', suggestion);
        },
        onSuggestionsChanged: (suggestions) => {
            onSuggestionsChanged(suggestions);
        },
    })), [onSuggestionsChanged]);
    return _jsx(Milkdown, {});
};
const SuggestionPanel = ({ suggestions, onAccept, onReject, }) => {
    if (!suggestions.length) {
        return _jsx("p", { className: "suggestion-panel__empty", children: "No pending suggestions. Ask the agent for more edits!" });
    }
    return (_jsx("ul", { className: "suggestion-panel__list", children: suggestions.map((suggestion) => (_jsxs("li", { className: "suggestion-panel__item", children: [_jsxs("div", { className: "suggestion-panel__texts", children: [_jsx("span", { className: "suggestion-panel__old", children: suggestion.oldText }), _jsx("span", { className: "suggestion-panel__arrow", children: "\u2192" }), _jsx("span", { className: "suggestion-panel__new", children: suggestion.newText })] }), _jsxs("div", { className: "suggestion-panel__actions", children: [_jsx("button", { type: "button", onClick: () => onReject(suggestion.id), children: "Reject" }), _jsx("button", { type: "button", className: "primary", onClick: () => onAccept(suggestion.id), children: "Accept" })] })] }, suggestion.id))) }));
};
const Playground = () => {
    const [loading, getEditor] = useInstance();
    const [suggestions, setSuggestions] = useState([]);
    const refreshSuggestions = useCallback(() => {
        if (loading)
            return;
        const editor = getEditor();
        editor?.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            setSuggestions(collectSuggestions(view.state.doc));
        });
    }, [loading, getEditor]);
    const seedSuggestions = useCallback(() => {
        if (loading)
            return;
        const editor = getEditor();
        editor?.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            const existingIds = new Set(collectSuggestions(state.doc).map((item) => item.id));
            const ranges = demoSuggestions
                .map((suggestion) => {
                if (existingIds.has(suggestion.id))
                    return null;
                const range = computeRanges(state.doc, suggestion.search);
                if (!range)
                    return null;
                return { suggestion, range };
            })
                .filter((item) => Boolean(item))
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
    }, [loading, getEditor, refreshSuggestions]);
    useEffect(() => {
        if (loading)
            return;
        seedSuggestions();
    }, [loading, seedSuggestions]);
    const accept = useCallback((id) => {
        if (loading)
            return;
        const editor = getEditor();
        editor?.action((ctx) => {
            acceptSuggestion(id)(ctx);
        });
        refreshSuggestions();
    }, [loading, getEditor, refreshSuggestions]);
    const reject = useCallback((id) => {
        if (loading)
            return;
        const editor = getEditor();
        editor?.action((ctx) => {
            rejectSuggestion(id)(ctx);
        });
        refreshSuggestions();
    }, [loading, getEditor, refreshSuggestions]);
    const reset = useCallback(() => {
        if (loading)
            return;
        const editor = getEditor();
        editor?.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state, dispatch } = view;
            const tr = state.tr;
            tr.delete(0, state.doc.content.size);
            tr.insertText(initialMarkdown, 0);
            dispatch(tr);
        });
        seedSuggestions();
    }, [loading, getEditor, seedSuggestions]);
    const handleSuggestionsChanged = useCallback((newSuggestions) => {
        setSuggestions(newSuggestions);
    }, []);
    return (_jsxs("div", { className: "app", children: [_jsxs("div", { className: "editor-card", children: [_jsxs("div", { className: "card-header", children: [_jsx("h1", { children: "Agent Suggestion Playground" }), _jsx("button", { type: "button", onClick: reset, children: "Reset Demo" })] }), _jsx("p", { className: "card-subtitle", children: "The editor below is locked for manual typing. Suggestions arrive programmatically and you decide what sticks." }), _jsx(DemoMilkdown, { onSuggestionsChanged: handleSuggestionsChanged })] }), _jsxs("aside", { className: "suggestion-panel", children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { children: "Pending Suggestions" }), _jsx("button", { type: "button", onClick: seedSuggestions, children: "Recreate Suggestions" })] }), _jsx(SuggestionPanel, { suggestions: suggestions, onAccept: accept, onReject: reject })] })] }));
};
const App = () => (_jsx(MilkdownProvider, { children: _jsx(Playground, {}) }));
export default App;
//# sourceMappingURL=App.js.map