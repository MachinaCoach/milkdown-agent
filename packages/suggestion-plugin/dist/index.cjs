"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AcceptAllSuggestions: () => AcceptAllSuggestions,
  AcceptSuggestion: () => AcceptSuggestion,
  InsertSuggestion: () => InsertSuggestion,
  RejectAllSuggestions: () => RejectAllSuggestions,
  RejectSuggestion: () => RejectSuggestion,
  acceptAllSuggestions: () => acceptAllSuggestions,
  acceptSuggestion: () => acceptSuggestion,
  agentSuggestion: () => agentSuggestion,
  collectSuggestions: () => collectSuggestions,
  insertSuggestion: () => insertSuggestion,
  lockEditor: () => lockEditor,
  rejectAllSuggestions: () => rejectAllSuggestions,
  rejectSuggestion: () => rejectSuggestion,
  unlockEditor: () => unlockEditor
});
module.exports = __toCommonJS(src_exports);
var import_core = require("@milkdown/core");
var import_utils = require("@milkdown/utils");
var InsertSuggestion = (0, import_core.createCmdKey)("InsertSuggestion");
var AcceptSuggestion = (0, import_core.createCmdKey)("AcceptSuggestion");
var RejectSuggestion = (0, import_core.createCmdKey)("RejectSuggestion");
var AcceptAllSuggestions = (0, import_core.createCmdKey)("AcceptAllSuggestions");
var RejectAllSuggestions = (0, import_core.createCmdKey)("RejectAllSuggestions");
var agentSuggestionNode = (0, import_utils.$node)("agentSuggestion", () => ({
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
var insertSuggestionCommand = (0, import_utils.$command)("InsertSuggestion", (ctx) => (payload) => {
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
var acceptSuggestionCommand = (0, import_utils.$command)("AcceptSuggestion", (ctx) => (id) => {
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
var rejectSuggestionCommand = (0, import_utils.$command)("RejectSuggestion", (ctx) => (id) => {
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
var acceptAllSuggestionsCommand = (0, import_utils.$command)("AcceptAllSuggestions", (ctx) => () => {
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
var rejectAllSuggestionsCommand = (0, import_utils.$command)("RejectAllSuggestions", (ctx) => () => {
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
  ctx.update(import_core.editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => false
  }));
};
var unlockEditor = (ctx) => {
  ctx.update(import_core.editorViewOptionsCtx, (prev) => ({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
