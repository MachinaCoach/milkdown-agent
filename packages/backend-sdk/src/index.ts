/**
 * @milkdown-agent/backend-sdk
 * Minimal backend helpers for parsing and validating patches
 * Reference: BACKEND_SDK_SUMMARY.md lines 16-42
 */

import { parseAiderFormat, serializeAiderFormat, validateMarkdown as coreValidateMarkdown, type ParsedPatch, type ChangeFormat, type ValidationResult } from '@milkdown-agent/core';

/**
 * Parse document with patches into clean document + patches
 * Reference: BACKEND_SDK_SUMMARY.md lines 16-22
 */
export function parseDocument(
  textWithPatches: string,
  format: ChangeFormat = 'aider'
): { document: string; patches: ParsedPatch[] } {
  switch (format) {
    case 'aider':
      return parseAiderFormat(textWithPatches);
    case 'anthropic':
      // TODO: Implement Anthropic format
      throw new Error('Anthropic format not yet implemented');
    case 'unified-diff':
      // TODO: Implement unified diff format
      throw new Error('Unified diff format not yet implemented');
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Serialize patches back to wire format
 * Reference: BACKEND_SDK_SUMMARY.md lines 24-31
 */
export function serializePatches(
  patches: ParsedPatch[],
  format: ChangeFormat = 'aider'
): string {
  switch (format) {
    case 'aider':
      return serializeAiderFormat(patches);
    case 'anthropic':
      // TODO: Implement Anthropic format
      throw new Error('Anthropic format not yet implemented');
    case 'unified-diff':
      // TODO: Implement unified diff format
      throw new Error('Unified diff format not yet implemented');
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Validate markdown structure
 * Reference: BACKEND_SDK_SUMMARY.md lines 33-42
 */
export function validateMarkdown(document: string): ValidationResult {
  return coreValidateMarkdown(document);
}

// Re-export types
export type { ParsedPatch, ChangeFormat, ValidationResult } from '@milkdown-agent/core';
