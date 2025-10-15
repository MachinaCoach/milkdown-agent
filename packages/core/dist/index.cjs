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
  createPatchId: () => createPatchId,
  formatAsPatch: () => formatAsPatch,
  parseAiderFormat: () => parseAiderFormat,
  serializeAiderFormat: () => serializeAiderFormat,
  validateMarkdown: () => validateMarkdown
});
module.exports = __toCommonJS(src_exports);

// src/parsers/aider.ts
var AIDER_PATTERN = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/g;
function parseAiderFormat(text) {
  const patches = [];
  let cleanDocument = text;
  let match;
  while ((match = AIDER_PATTERN.exec(text)) !== null) {
    const search = match[1];
    const replace = match[2];
    patches.push({
      search,
      replace,
      operation: detectOperation(search, replace)
    });
    cleanDocument = cleanDocument.replace(match[0], replace);
  }
  return { document: cleanDocument, patches };
}
function serializeAiderFormat(patches) {
  return patches.map(
    (patch) => `<<<SEARCH
${patch.search}
===
${patch.replace}
>>>`
  ).join("\n\n");
}
function formatAsPatch(search, replace) {
  return `<<<SEARCH
${search}
===
${replace}
>>>`;
}
function detectOperation(search, replace) {
  if (search.trim() === "" && replace.trim() !== "") {
    return "add";
  } else if (search.trim() !== "" && replace.trim() === "") {
    return "remove";
  } else {
    return "change";
  }
}
function createPatchId(search, replace) {
  const content = `${search}|||${replace}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "chg_" + Math.abs(hash).toString(36);
}

// src/validators/markdown.ts
var import_remark = require("remark");
function validateMarkdown(document) {
  try {
    const processor = (0, import_remark.remark)();
    const ast = processor.parse(document);
    if (ast.errors && ast.errors.length > 0) {
      return {
        valid: false,
        // @ts-ignore
        errors: ast.errors.map((e) => e.message)
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown error"]
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createPatchId,
  formatAsPatch,
  parseAiderFormat,
  serializeAiderFormat,
  validateMarkdown
});
