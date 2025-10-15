// src/index.ts
import { parseAiderFormat, serializeAiderFormat, validateMarkdown as coreValidateMarkdown } from "@milkdown-agent/core";
function parseDocument(textWithPatches, format = "aider") {
  switch (format) {
    case "aider":
      return parseAiderFormat(textWithPatches);
    case "anthropic":
      throw new Error("Anthropic format not yet implemented");
    case "unified-diff":
      throw new Error("Unified diff format not yet implemented");
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
function serializePatches(patches, format = "aider") {
  switch (format) {
    case "aider":
      return serializeAiderFormat(patches);
    case "anthropic":
      throw new Error("Anthropic format not yet implemented");
    case "unified-diff":
      throw new Error("Unified diff format not yet implemented");
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
function validateMarkdown(document) {
  return coreValidateMarkdown(document);
}
export {
  parseDocument,
  serializePatches,
  validateMarkdown
};
