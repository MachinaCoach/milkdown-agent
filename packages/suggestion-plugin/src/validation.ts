/**
 * Validation pipeline for patches
 * Reference: START_HERE.md lines 247-290, IMPLEMENTATION_SPEC.md lines 579-636
 */

import type { ApplyResult, ApplyError, Patch } from '@milkdown-agent/core';
import { validateMarkdown } from '@milkdown-agent/core';

/**
 * Validate patches before applying
 * 5-step validation pipeline:
 * 1. Parse patch
 * 2. Validate uniqueness (not ambiguous)
 * 3. Check conflicts with existing patches
 * 4. Validate markdown structure
 * 5. Apply with fuzzy matching
 */
export function validatePatches(
  patches: any[],
  document: string,
  existingPatches: Map<string, Patch>
): ApplyResult {
  const errors: ApplyError[] = [];
  let appliedCount = 0;
  
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    
    // 1. Parse patch
    const parsed = parsePatch(patch);
    if (!parsed.success) {
      errors.push({
        type: 'parse',
        message: parsed.error || 'Failed to parse patch',
        patchIndex: i,
        patchData: patch
      });
      continue;
    }
    
    // 2. Validate uniqueness (not ambiguous)
    const uniqueness = validateUniqueness(parsed.data, document);
    if (!uniqueness.valid) {
      errors.push({
        type: 'ambiguous',
        message: 'Search text appears multiple times in document',
        patchIndex: i,
        patchData: patch,
        suggestions: uniqueness.matches,
        context: uniqueness.context
      });
      continue;
    }
    
    // 3. Check conflicts with existing patches
    const conflicts = detectConflicts(parsed.data, existingPatches);
    if (conflicts.conflict) {
      errors.push({
        type: 'conflict',
        message: `Conflicts with existing patch: ${conflicts.conflictsWith}`,
        patchIndex: i,
        patchData: patch
      });
      continue;
    }
    
    // 4. Validate markdown structure
    const markdownValidation = validateMarkdownPatch(parsed.data, document);
    if (!markdownValidation.valid) {
      errors.push({
        type: 'invalid_markdown',
        message: 'Would break markdown structure',
        patchIndex: i,
        patchData: patch,
        suggestions: markdownValidation.errors
      });
      continue;
    }
    
    // 5. Apply with fuzzy matching (implemented in applyWithFuzzyMatching)
    // This step is done during actual application
    appliedCount++;
  }
  
  return {
    success: errors.length === 0,
    appliedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Parse a patch from wire format
 */
function parsePatch(patch: any): { success: boolean; data?: any; error?: string } {
  try {
    // TODO: Implement actual parsing based on format
    if (typeof patch === 'string') {
      return { success: true, data: patch };
    }
    return { success: true, data: patch };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Parse error'
    };
  }
}

/**
 * Validate that search text is unique in document
 */
function validateUniqueness(
  patch: any,
  document: string
): { valid: boolean; matches?: string[]; context?: string } {
  // TODO: Extract search text from patch
  const searchText = extractSearchText(patch);
  
  if (!searchText) {
    return { valid: true };
  }
  
  // Find all occurrences
  const matches: string[] = [];
  let index = 0;
  
  while ((index = document.indexOf(searchText, index)) !== -1) {
    // Get context around match
    const start = Math.max(0, index - 50);
    const end = Math.min(document.length, index + searchText.length + 50);
    const context = document.substring(start, end);
    matches.push(context);
    index += searchText.length;
  }
  
  if (matches.length > 1) {
    return {
      valid: false,
      matches,
      context: `Found ${matches.length} occurrences`
    };
  }
  
  return { valid: true };
}

/**
 * Detect conflicts with existing patches
 */
function detectConflicts(
  patch: any,
  existingPatches: Map<string, Patch>
): { conflict: boolean; conflictsWith?: string } {
  // TODO: Implement proper range overlap detection
  // For now, just check if patch already exists
  
  for (const [id, existing] of existingPatches) {
    // Check if ranges overlap
    // This is a simplified check - should use actual positions
    if (existing.data === patch) {
      return { conflict: true, conflictsWith: id };
    }
  }
  
  return { conflict: false };
}

/**
 * Validate that applying patch won't break markdown
 */
function validateMarkdownPatch(
  patch: any,
  document: string
): { valid: boolean; errors?: string[] } {
  try {
    // Apply patch to test document
    const testDoc = applyPatchToString(patch, document);
    
    // Validate with remark
    const validation = validateMarkdown(testDoc);
    
    return validation;
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Validation error']
    };
  }
}

/**
 * Apply patch to string (for testing)
 */
function applyPatchToString(patch: any, document: string): string {
  // TODO: Implement actual patch application
  return document;
}

/**
 * Extract search text from patch
 */
function extractSearchText(patch: any): string {
  // TODO: Parse patch format to extract search text
  if (typeof patch === 'string') {
    const match = patch.match(/<<<SEARCH\n([\s\S]*?)\n===/);
    return match ? match[1] : '';
  }
  return '';
}
