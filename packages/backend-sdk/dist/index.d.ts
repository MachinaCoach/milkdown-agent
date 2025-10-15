import { ChangeFormat, ParsedPatch, ValidationResult } from '@milkdown-agent/core';
export { ChangeFormat, ParsedPatch, ValidationResult } from '@milkdown-agent/core';

/**
 * @milkdown-agent/backend-sdk
 * Minimal backend helpers for parsing and validating patches
 * Reference: BACKEND_SDK_SUMMARY.md lines 16-42
 */

/**
 * Parse document with patches into clean document + patches
 * Reference: BACKEND_SDK_SUMMARY.md lines 16-22
 */
declare function parseDocument(textWithPatches: string, format?: ChangeFormat): {
    document: string;
    patches: ParsedPatch[];
};
/**
 * Serialize patches back to wire format
 * Reference: BACKEND_SDK_SUMMARY.md lines 24-31
 */
declare function serializePatches(patches: ParsedPatch[], format?: ChangeFormat): string;
/**
 * Validate markdown structure
 * Reference: BACKEND_SDK_SUMMARY.md lines 33-42
 */
declare function validateMarkdown(document: string): ValidationResult;

export { parseDocument, serializePatches, validateMarkdown };
