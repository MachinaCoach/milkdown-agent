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
  agentCommands: () => agentCommands,
  agentSuggestion: () => agentSuggestion
});
module.exports = __toCommonJS(src_exports);

// src/agentPlugin.ts
var import_utils = require("@milkdown/utils");

// src/state.ts
function createInitialState() {
  return {
    version: 1,
    documentText: "",
    patches: /* @__PURE__ */ new Map(),
    pendingChanges: {
      hasDocumentChanges: false,
      hasPatchChanges: false,
      acceptedPatches: /* @__PURE__ */ new Set(),
      rejectedPatches: /* @__PURE__ */ new Set(),
      newPatches: /* @__PURE__ */ new Set()
    }
  };
}
function clearPendingChanges(state) {
  state.pendingChanges.hasDocumentChanges = false;
  state.pendingChanges.hasPatchChanges = false;
  state.pendingChanges.acceptedPatches.clear();
  state.pendingChanges.rejectedPatches.clear();
  state.pendingChanges.newPatches.clear();
}
function incrementVersion(state) {
  state.version++;
}

// src/flush.ts
var import_core = require("@milkdown-agent/core");

// src/commands.ts
function acceptPatch(state, patchId, callbacks) {
  const patch = state.patches.get(patchId);
  if (!patch) {
    return false;
  }
  state.patches.delete(patchId);
  state.pendingChanges.acceptedPatches.add(patchId);
  state.pendingChanges.hasPatchChanges = true;
  callbacks?.onPatchAccepted?.(patch);
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
  return true;
}
function rejectPatch(state, patchId, reason, callbacks) {
  const patch = state.patches.get(patchId);
  if (!patch) {
    return false;
  }
  state.patches.delete(patchId);
  state.pendingChanges.rejectedPatches.add(patchId);
  state.pendingChanges.hasPatchChanges = true;
  callbacks?.onPatchRejected?.(patch, reason);
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
  return true;
}
function acceptAllPatches(state, callbacks) {
  const patchIds = Array.from(state.patches.keys());
  for (const id of patchIds) {
    acceptPatch(state, id, callbacks);
  }
}
function rejectAllPatches(state, callbacks) {
  const patchIds = Array.from(state.patches.keys());
  for (const id of patchIds) {
    rejectPatch(state, id, "explicit", callbacks);
  }
}
function addPatch(state, patch, callbacks) {
  state.patches.set(patch.id, patch);
  state.pendingChanges.newPatches.add(patch.id);
  state.pendingChanges.hasPatchChanges = true;
  if (patch.source === "inline") {
    state.pendingChanges.hasDocumentChanges = true;
  }
  callbacks?.onPatchesChanged?.(Array.from(state.patches.values()));
}

// src/flush.ts
function createSnapshot(state) {
  return {
    version: state.version,
    hasDocumentChanges: state.pendingChanges.hasDocumentChanges,
    hasPatchChanges: state.pendingChanges.hasPatchChanges,
    documentWithPatches: state.pendingChanges.hasDocumentChanges ? getDocumentWithPatches(state) : void 0,
    patches: state.pendingChanges.hasPatchChanges ? Array.from(state.patches.values()).map((p) => p.data) : void 0,
    acceptedPatches: Array.from(state.pendingChanges.acceptedPatches),
    rejectedPatches: Array.from(state.pendingChanges.rejectedPatches),
    newPatches: Array.from(state.pendingChanges.newPatches)
  };
}
function getDocumentWithPatches(state) {
  return state.documentText;
}
async function executeFlush(state, syncFn, callbacks) {
  const snapshot = createSnapshot(state);
  const initialVersion = state.version;
  return new Promise((resolve) => {
    const success = (patchesOrDocument, version) => {
      try {
        if (typeof patchesOrDocument === "string") {
        } else if (Array.isArray(patchesOrDocument)) {
          let workingDocument = state.documentText;
          for (const patchData of patchesOrDocument) {
            const instrumented = toInstrumentedPatch(patchData, workingDocument);
            if (!instrumented) {
              continue;
            }
            workingDocument = instrumented.updatedDocument;
            addPatch(state, instrumented.patch, callbacks);
          }
        }
        if (version !== void 0) {
          state.version = version;
        } else {
          incrementVersion(state);
        }
        clearPendingChanges(state);
        resolve({
          success: true,
          version: state.version
        });
      } catch (error) {
        state.version = initialVersion;
        resolve({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    };
    const failure = (error, serverDocument, serverVersion) => {
      resolve({
        success: false,
        error,
        serverDocument,
        serverVersion
      });
    };
    try {
      const result = syncFn(snapshot, success, failure);
      if (result instanceof Promise) {
        result.catch((error) => {
          failure(error.message || "Sync function failed");
        });
      }
    } catch (error) {
      failure(error instanceof Error ? error.message : "Sync function threw error");
    }
  });
}
function simpleFlush(state) {
  incrementVersion(state);
  clearPendingChanges(state);
}
function detectOperation(search, replace) {
  if (!search.trim() && replace.trim()) {
    return "add";
  }
  if (search.trim() && !replace.trim()) {
    return "remove";
  }
  return "change";
}
function extractPatchParts(patch) {
  if (typeof patch === "string") {
    const match = patch.match(/<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/);
    if (match) {
      return { search: match[1], replace: match[2] };
    }
  }
  if (typeof patch === "object" && patch !== null) {
    const maybePatch = patch;
    if (typeof maybePatch.search === "string" && typeof maybePatch.replace === "string") {
      return { search: maybePatch.search, replace: maybePatch.replace };
    }
  }
  return null;
}
function toInstrumentedPatch(patchData, document2) {
  const parts = extractPatchParts(patchData);
  if (!parts) {
    return null;
  }
  const { search, replace } = parts;
  const operation = detectOperation(search, replace);
  const id = (0, import_core.createPatchId)(search, replace);
  let position = 0;
  let updatedDocument = document2;
  if (search) {
    const index = document2.indexOf(search);
    if (index !== -1) {
      position = index;
      updatedDocument = document2.slice(0, index) + replace + document2.slice(index + search.length);
    } else {
      position = document2.length;
    }
  } else {
    position = document2.length;
    updatedDocument = document2 + replace;
  }
  return {
    patch: {
      id,
      data: patchData,
      operation,
      source: "instrumented",
      position
    },
    updatedDocument
  };
}

// src/tracking.ts
var import_core2 = require("@milkdown-agent/core");
var changesByPosition = /* @__PURE__ */ new Map();
function trackUserEdits(tr) {
  if (!tr.docChanged) {
    return [];
  }
  const patches = [];
  const beforeDoc = tr.docs[0];
  const afterDoc = tr.doc;
  for (const step of tr.steps) {
    const stepMap = step.getMap();
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      const oldSize = oldEnd - oldStart;
      const newSize = newEnd - newStart;
      const oldText = beforeDoc ? beforeDoc.textBetween(oldStart, oldEnd, "\n", "\n") : "";
      let newText = afterDoc.textBetween(newStart, newEnd, "\n", "\n");
      if (!newText) {
        newText = getInsertedText(step);
      }
      let operation;
      if (oldSize === 0 && newSize > 0) {
        operation = "add";
      } else if (oldSize > 0 && newSize === 0) {
        operation = "remove";
      } else {
        operation = "change";
      }
      const existingChange = changesByPosition.get(newStart);
      if (existingChange) {
        const merged = {
          from: newStart,
          to: newEnd,
          oldText: existingChange.oldText,
          // Keep original
          newText,
          // Update to latest
          operation: existingChange.operation
        };
        changesByPosition.set(newStart, merged);
        const patch = changeToPatch(merged);
        patches.push(patch);
      } else {
        const change = {
          from: newStart,
          to: newEnd,
          oldText,
          newText,
          operation
        };
        changesByPosition.set(newStart, change);
        const patch = changeToPatch(change);
        patches.push(patch);
      }
    });
  }
  return reconcilePatches(patches);
}
function getInsertedText(step) {
  const anyStep = step;
  const slice = anyStep?.slice;
  if (slice && typeof slice === "object" && "content" in slice && typeof slice.content?.textBetween === "function") {
    try {
      return slice.content.textBetween(0, slice.size ?? 0, "\n", "\n");
    } catch {
    }
  }
  if (typeof anyStep?.toJSON === "function") {
    const json = anyStep.toJSON();
    if (json && typeof json === "object" && "slice" in json) {
      const sliceContent = json.slice?.content;
      if (typeof sliceContent === "string") {
        return sliceContent;
      }
    }
  }
  return "";
}
function changeToPatch(change) {
  const data = (0, import_core2.formatAsPatch)(change.oldText, change.newText);
  const id = (0, import_core2.createPatchId)(change.oldText, change.newText);
  return {
    id,
    data,
    operation: change.operation,
    source: "inline",
    position: change.from
  };
}
function reconcilePatches(patches) {
  if (patches.length === 0)
    return [];
  const reconciled = [];
  const seen = /* @__PURE__ */ new Set();
  for (const patch of patches) {
    if (seen.has(patch.id)) {
      continue;
    }
    seen.add(patch.id);
    const overlapping = reconciled.find(
      (p) => p.position === patch.position && p.id !== patch.id
    );
    if (overlapping) {
      const index = reconciled.indexOf(overlapping);
      reconciled[index] = patch;
    } else {
      reconciled.push(patch);
    }
  }
  return reconciled;
}

// src/agentPlugin.ts
var import_state3 = require("@milkdown/prose/state");

// src/decorations.ts
var import_view = require("@milkdown/prose/view");
function createPatchDecorations(patches, state) {
  const decorations = [];
  for (const patch of patches) {
    const decoration = createPatchDecoration(patch, state);
    if (decoration) {
      decorations.push(decoration);
    }
  }
  return import_view.DecorationSet.create(state.doc, decorations);
}
function createPatchDecoration(patch, state) {
  const { position, operation, id, source } = patch;
  const className = getDecorationClass(operation, source);
  const decoration = import_view.Decoration.inline(
    position,
    position + 1,
    // TODO: Calculate actual end position
    {
      class: className,
      "data-patch-id": id,
      "data-patch-operation": operation,
      "data-patch-source": source
    }
  );
  return decoration;
}
function getDecorationClass(operation, source) {
  const baseClass = "milkdown-agent-patch";
  const operationClass = `${baseClass}--${operation}`;
  const sourceClass = source === "inline" ? `${baseClass}--user` : `${baseClass}--ai`;
  return `${baseClass} ${operationClass} ${sourceClass}`;
}

// src/agentPlugin.ts
var agentPluginKey = new import_state3.PluginKey("agent-suggestion");
function agentSuggestion(config = {}) {
  const state = createInitialState();
  const callbacks = {
    onPatchAccepted: config.onPatchAccepted,
    onPatchRejected: config.onPatchRejected,
    onPatchesChanged: config.onPatchesChanged
  };
  currentState = state;
  currentCallbacks = callbacks;
  return (0, import_utils.$prose)(() => {
    return new import_state3.Plugin({
      key: agentPluginKey,
      state: {
        init: (_config, editorState) => {
          state.documentText = editorState.doc.textBetween(
            0,
            editorState.doc.content.size,
            "\n",
            "\n"
          );
          return state;
        },
        apply: (tr, pluginState, _oldState, newState) => {
          if (tr.docChanged) {
            const patches = trackUserEdits(tr);
            patches.forEach((patch) => {
              addPatch(state, patch, callbacks);
            });
          }
          state.documentText = newState.doc.textBetween(
            0,
            newState.doc.content.size,
            "\n",
            "\n"
          );
          return pluginState;
        }
      },
      view: (editorView) => {
        state.documentText = editorView.state.doc.textBetween(
          0,
          editorView.state.doc.content.size,
          "\n",
          "\n"
        );
        return {
          update: (view) => {
            state.documentText = view.state.doc.textBetween(
              0,
              view.state.doc.content.size,
              "\n",
              "\n"
            );
          },
          destroy: () => {
            state.documentText = "";
          }
        };
      },
      // Visual diff overlay with decorations
      props: {
        decorations: (editorState) => {
          const patches = Array.from(state.patches.values());
          return createPatchDecorations(patches, editorState);
        },
        // Handle clicks on accept/reject buttons
        handleDOMEvents: {
          click: (view, event) => {
            const target = event.target;
            if (target.classList.contains("milkdown-agent-patch-btn")) {
              const action = target.getAttribute("data-action");
              const patchId = target.getAttribute("data-patch-id");
              if (patchId) {
                if (action === "accept") {
                  acceptPatch(state, patchId, callbacks);
                } else if (action === "reject") {
                  rejectPatch(state, patchId, "explicit", callbacks);
                }
                event.preventDefault();
                event.stopPropagation();
                return true;
              }
            }
            return false;
          }
        }
      }
    });
  });
}
var currentState = null;
var currentCallbacks = null;
var agentCommands = {
  /**
   * Flush with sync
   */
  flush: async (syncFn) => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    return executeFlush(currentState, syncFn, currentCallbacks || void 0);
  },
  /**
   * Simple flush (no sync)
   */
  simpleFlush: () => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    simpleFlush(currentState);
  },
  /**
   * Accept a patch
   */
  acceptPatch: (patchId) => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    return acceptPatch(currentState, patchId, currentCallbacks || void 0);
  },
  /**
   * Reject a patch
   */
  rejectPatch: (patchId) => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    return rejectPatch(currentState, patchId, "explicit", currentCallbacks || void 0);
  },
  /**
   * Accept all patches
   */
  acceptAllPatches: () => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    acceptAllPatches(currentState, currentCallbacks || void 0);
  },
  /**
   * Reject all patches
   */
  rejectAllPatches: () => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    rejectAllPatches(currentState, currentCallbacks || void 0);
  },
  /**
   * Get current patches
   */
  getPatches: () => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    return Array.from(currentState.patches.values());
  },
  /**
   * Get current version
   */
  getVersion: () => {
    if (!currentState) {
      throw new Error("Agent plugin not initialized");
    }
    return currentState.version;
  }
};

// src/commands/insert.ts
var import_core3 = require("@milkdown/core");
var import_utils3 = require("@milkdown/utils");

// src/schema/node.ts
var import_utils2 = require("@milkdown/utils");
var agentSuggestionNode = (0, import_utils2.$node)("agentSuggestion", () => ({
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

// src/commands/insert.ts
var InsertSuggestion = (0, import_core3.createCmdKey)("InsertSuggestion");
var insertSuggestionCommand = (0, import_utils3.$command)("InsertSuggestion", (ctx) => (payload) => {
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

// src/commands/accept.ts
var import_core4 = require("@milkdown/core");
var import_utils5 = require("@milkdown/utils");

// src/context.ts
var import_utils4 = require("@milkdown/utils");
var suggestionCallbacksCtx = (0, import_utils4.$ctx)({}, "suggestionCallbacks");

// src/utils/collect.ts
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

// src/commands/accept.ts
var AcceptSuggestion = (0, import_core4.createCmdKey)("AcceptSuggestion");
var acceptSuggestionCommand = (0, import_utils5.$command)("AcceptSuggestion", (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    let acceptedSuggestion = null;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        acceptedSuggestion = {
          id: node.attrs.id,
          oldText: node.attrs.oldText,
          newText: node.attrs.newText,
          metadata: node.attrs.metadata,
          pos
        };
        const newText = node.attrs.newText;
        if (!newText || newText.length === 0) {
          tr.delete(pos, pos + node.nodeSize);
        } else {
          tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(newText));
        }
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
      const callbacks = ctx.get(suggestionCallbacksCtx.key);
      if (acceptedSuggestion && callbacks.onSuggestionAccepted) {
        callbacks.onSuggestionAccepted(acceptedSuggestion);
      }
      if (callbacks.onSuggestionsChanged) {
        const view = ctx.get(import_core4.editorViewCtx);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});

// src/commands/reject.ts
var import_core5 = require("@milkdown/core");
var import_utils6 = require("@milkdown/utils");
var RejectSuggestion = (0, import_core5.createCmdKey)("RejectSuggestion");
var rejectSuggestionCommand = (0, import_utils6.$command)("RejectSuggestion", (ctx) => (id) => {
  return (state, dispatch) => {
    let found = false;
    let rejectedSuggestion = null;
    const tr = state.tr;
    const nodeType = agentSuggestionNode.type(ctx);
    state.doc.descendants((node, pos) => {
      if (node.type === nodeType && node.attrs.id === id) {
        found = true;
        rejectedSuggestion = {
          id: node.attrs.id,
          oldText: node.attrs.oldText,
          newText: node.attrs.newText,
          metadata: node.attrs.metadata,
          pos
        };
        tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.oldText));
        return false;
      }
      return true;
    });
    if (found && dispatch) {
      dispatch(tr);
      const callbacks = ctx.get(suggestionCallbacksCtx.key);
      if (rejectedSuggestion && callbacks.onSuggestionRejected) {
        callbacks.onSuggestionRejected(rejectedSuggestion);
      }
      if (callbacks.onSuggestionsChanged) {
        const view = ctx.get(import_core5.editorViewCtx);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});

// src/commands/batch.ts
var import_core6 = require("@milkdown/core");
var import_utils7 = require("@milkdown/utils");
var AcceptAllSuggestions = (0, import_core6.createCmdKey)("AcceptAllSuggestions");
var RejectAllSuggestions = (0, import_core6.createCmdKey)("RejectAllSuggestions");
var acceptAllSuggestionsCommand = (0, import_utils7.$command)("AcceptAllSuggestions", (ctx) => () => {
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
var rejectAllSuggestionsCommand = (0, import_utils7.$command)("RejectAllSuggestions", (ctx) => () => {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AcceptAllSuggestions,
  AcceptSuggestion,
  InsertSuggestion,
  RejectAllSuggestions,
  RejectSuggestion,
  agentCommands,
  agentSuggestion
});
