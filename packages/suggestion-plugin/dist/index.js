// src/agentPlugin.ts
import { $prose } from "@milkdown/utils";

// src/state.ts
function createInitialState() {
  return {
    version: 1,
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
  return "";
}
async function executeFlush(state, syncFn) {
  const snapshot = createSnapshot(state);
  const initialVersion = state.version;
  return new Promise((resolve) => {
    const success = (patchesOrDocument, version) => {
      try {
        if (typeof patchesOrDocument === "string") {
        } else if (Array.isArray(patchesOrDocument)) {
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

// src/tracking.ts
import { createPatchId, formatAsPatch } from "@milkdown-agent/core";
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
      const oldText = beforeDoc ? beforeDoc.textBetween(oldStart, oldEnd) : "";
      const newText = afterDoc.textBetween(newStart, newEnd);
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
function changeToPatch(change) {
  const data = formatAsPatch(change.oldText, change.newText);
  const id = createPatchId(change.oldText, change.newText);
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
import { Plugin as ProseMirrorPlugin, PluginKey } from "@milkdown/prose/state";

// src/decorations.ts
import { Decoration, DecorationSet } from "@milkdown/prose/view";
function createPatchDecorations(patches, state) {
  const decorations = [];
  for (const patch of patches) {
    const decoration = createPatchDecoration(patch, state);
    if (decoration) {
      decorations.push(decoration);
    }
  }
  return DecorationSet.create(state.doc, decorations);
}
function createPatchDecoration(patch, state) {
  const { position, operation, id, source } = patch;
  const className = getDecorationClass(operation, source);
  const decoration = Decoration.inline(
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
var agentPluginKey = new PluginKey("agent-suggestion");
function agentSuggestion(config = {}) {
  const state = createInitialState();
  const callbacks = {
    onPatchAccepted: config.onPatchAccepted,
    onPatchRejected: config.onPatchRejected,
    onPatchesChanged: config.onPatchesChanged
  };
  currentState = state;
  currentCallbacks = callbacks;
  return $prose(() => {
    return new ProseMirrorPlugin({
      key: agentPluginKey,
      state: {
        init: () => state,
        apply: (tr, pluginState) => {
          if (tr.docChanged) {
            const patches = trackUserEdits(tr);
            patches.forEach((patch) => {
              addPatch(state, patch, callbacks);
            });
          }
          return pluginState;
        }
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
    return executeFlush(currentState, syncFn);
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
import { createCmdKey } from "@milkdown/core";
import { $command } from "@milkdown/utils";

// src/schema/node.ts
import { $node } from "@milkdown/utils";
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

// src/commands/insert.ts
var InsertSuggestion = createCmdKey("InsertSuggestion");
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

// src/commands/accept.ts
import { createCmdKey as createCmdKey2, editorViewCtx } from "@milkdown/core";
import { $command as $command2 } from "@milkdown/utils";

// src/context.ts
import { $ctx as $ctx2 } from "@milkdown/utils";
var suggestionCallbacksCtx = $ctx2({}, "suggestionCallbacks");

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
var AcceptSuggestion = createCmdKey2("AcceptSuggestion");
var acceptSuggestionCommand = $command2("AcceptSuggestion", (ctx) => (id) => {
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
        const view = ctx.get(editorViewCtx);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});

// src/commands/reject.ts
import { createCmdKey as createCmdKey3, editorViewCtx as editorViewCtx2 } from "@milkdown/core";
import { $command as $command3 } from "@milkdown/utils";
var RejectSuggestion = createCmdKey3("RejectSuggestion");
var rejectSuggestionCommand = $command3("RejectSuggestion", (ctx) => (id) => {
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
        const view = ctx.get(editorViewCtx2);
        callbacks.onSuggestionsChanged(collectSuggestions(view.state.doc));
      }
    }
    return found;
  };
});

// src/commands/batch.ts
import { createCmdKey as createCmdKey4 } from "@milkdown/core";
import { $command as $command4 } from "@milkdown/utils";
var AcceptAllSuggestions = createCmdKey4("AcceptAllSuggestions");
var RejectAllSuggestions = createCmdKey4("RejectAllSuggestions");
var acceptAllSuggestionsCommand = $command4("AcceptAllSuggestions", (ctx) => () => {
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
var rejectAllSuggestionsCommand = $command4("RejectAllSuggestions", (ctx) => () => {
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
export {
  AcceptAllSuggestions,
  AcceptSuggestion,
  InsertSuggestion,
  RejectAllSuggestions,
  RejectSuggestion,
  agentCommands,
  agentSuggestion
};
