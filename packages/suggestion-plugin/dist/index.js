// src/index.ts
import { editorViewOptionsCtx, createCmdKey } from "@milkdown/core";
import { $node, $command } from "@milkdown/utils";
var InsertSuggestion = createCmdKey("InsertSuggestion");
var AcceptSuggestion = createCmdKey("AcceptSuggestion");
var RejectSuggestion = createCmdKey("RejectSuggestion");
var AcceptAllSuggestions = createCmdKey("AcceptAllSuggestions");
var RejectAllSuggestions = createCmdKey("RejectAllSuggestions");
var agentSuggestionNode = $node("agentSuggestion", () => ({
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  attrs: {
    id: { default: "" },
    oldText: { default: "" },
    newText: { default: "" },
    metadata: { default: null }
  },
  parseDOM: [
    {
      tag: "span[data-agent-suggestion]",
      getAttrs: (dom) => {
        const element = dom;
        const oldText = element.querySelector("[data-agent-suggestion-old]")?.textContent ?? "";
        const newText = element.querySelector("[data-agent-suggestion-new]")?.textContent ?? "";
        const metadata = element.getAttribute("data-agent-suggestion-meta");
        let parsed = null;
        if (metadata) {
          try {
            parsed = JSON.parse(metadata);
          } catch (error) {
            if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
              console.warn("Unable to parse suggestion metadata", error);
            }
          }
        }
        return {
          id: element.getAttribute("data-suggestion-id") ?? "",
          oldText,
          newText,
          metadata: parsed
        };
      }
    }
  ],
  toDOM: (node) => {
    const { id, oldText, newText, metadata } = node.attrs;
    return [
      "span",
      {
        "data-agent-suggestion": "true",
        "data-suggestion-id": id,
        "data-agent-suggestion-meta": metadata ? JSON.stringify(metadata) : void 0,
        class: "agent-suggestion"
      },
      ["span", { "data-agent-suggestion-old": "true", class: "agent-suggestion__old" }, oldText],
      ["span", { "data-agent-suggestion-new": "true", class: "agent-suggestion__new" }, newText]
    ];
  },
  parseMarkdown: {
    match: () => false,
    runner: () => {
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === "agentSuggestion",
    runner: (state, node) => {
      state.addNode("text", void 0, node.attrs.newText || "");
    }
  }
}));
var insertSuggestionCommand = $command("InsertSuggestion", (ctx) => (payload) => {
  return (state, dispatch) => {
    if (!payload)
      return false;
    const { from, to, id, newText } = payload;
    if (!id)
      return false;
    const docSize = state.doc.content.size;
    if (from < 0 || to > docSize || from >= to)
      return false;
    const nodeType = agentSuggestionNode.type(ctx);
    let duplicate = false;
    state.doc.descendants((node2) => {
      if (node2.type === nodeType && node2.attrs.id === id) {
        duplicate = true;
        return false;
      }
      return true;
    });
    if (duplicate)
      return false;
    const oldText = payload.oldText ?? state.doc.textBetween(from, to, "\n");
    const node = nodeType.create({
      id,
      oldText,
      newText,
      metadata: payload.metadata ?? null
    });
    if (dispatch) {
      dispatch(state.tr.replaceWith(from, to, node));
    }
    return true;
  };
});
var acceptSuggestionCommand = $command("AcceptSuggestion", (ctx) => (id) => {
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
var rejectSuggestionCommand = $command("RejectSuggestion", (ctx) => (id) => {
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
var acceptAllSuggestionsCommand = $command("AcceptAllSuggestions", (ctx) => () => {
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
var rejectAllSuggestionsCommand = $command("RejectAllSuggestions", (ctx) => () => {
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
var agentSuggestion = () => [
  agentSuggestionNode,
  insertSuggestionCommand,
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  acceptAllSuggestionsCommand,
  rejectAllSuggestionsCommand
];
var lockEditor = (ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => false
  }));
};
var unlockEditor = (ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => true
  }));
};
var collectSuggestions = (doc) => {
  const results = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "agentSuggestion") {
      results.push({
        id: node.attrs.id,
        oldText: node.attrs.oldText,
        newText: node.attrs.newText,
        metadata: node.attrs.metadata,
        pos
      });
    }
    return true;
  });
  return results;
};
var insertSuggestion = (payload) => (ctx) => {
  return insertSuggestionCommand.run(payload);
};
var acceptSuggestion = (id) => (ctx) => {
  return acceptSuggestionCommand.run(id);
};
var rejectSuggestion = (id) => (ctx) => {
  return rejectSuggestionCommand.run(id);
};
var acceptAllSuggestions = () => (ctx) => {
  return acceptAllSuggestionsCommand.run();
};
var rejectAllSuggestions = () => (ctx) => {
  return rejectAllSuggestionsCommand.run();
};
export {
  AcceptAllSuggestions,
  AcceptSuggestion,
  InsertSuggestion,
  RejectAllSuggestions,
  RejectSuggestion,
  acceptAllSuggestions,
  acceptSuggestion,
  agentSuggestion,
  collectSuggestions,
  insertSuggestion,
  lockEditor,
  rejectAllSuggestions,
  rejectSuggestion,
  unlockEditor
};
