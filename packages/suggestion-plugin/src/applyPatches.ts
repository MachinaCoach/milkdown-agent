/**
 * Apply patches with full validation and fuzzy matching
 * Reference: IMPLEMENTATION_SPEC.md lines 579-636
 */

import type { ApplyResult, ApplyError } from '@milkdown-agent/core';
import { parseAiderFormat } from '@milkdown-agent/core';
import { applyWithFuzzyMatching, applyReplacement } from './fuzzyMatch.js';
import { validatePatches } from './validation.js';
import type { PluginState } from './state.js';

/**
 * Apply patches from backend to document
 * Uses validation pipeline and fuzzy matching
 */
export function applyPatchesToDocument<T>(
  patches: T[],
  document: string,
  state: PluginState<T>
): ApplyResult {
  const errors: ApplyError[] = [];
  let appliedCount = 0;
  let currentDoc = document;
  
  // First, validate all patches
  const validation = validatePatches(patches, document, state.patches as any);
  if (!validation.success && validation.errors) {
    return validation;
  }
  
  // Apply each patch with fuzzy matching
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    
    try {
      // Parse patch to get search/replace
      const { search, replace } = parsePatchData(patch);
      
      if (!search && !replace) {
        errors.push({
          type: 'parse',
          message: 'Could not extract search/replace from patch',
          patchIndex: i,
          patchData: patch
        });
        continue;
      }
      
      // Apply with fuzzy matching
      const matchResult = applyWithFuzzyMatching(search, replace, currentDoc);
      
      if (!matchResult.success) {
        errors.push({
          type: 'match',
          message: matchResult.error || 'Failed to match search text',
          patchIndex: i,
          patchData: patch,
          suggestions: matchResult.suggestions,
          context: matchResult.context
        });
        continue;
      }
      
      // Apply the replacement
      if (matchResult.position !== undefined) {
        currentDoc = applyReplacement(
          currentDoc,
          matchResult.position,
          search.length,
          replace
        );
        appliedCount++;
      }
      
    } catch (error) {
      errors.push({
        type: 'parse',
        message: error instanceof Error ? error.message : 'Unknown error',
        patchIndex: i,
        patchData: patch
      });
    }
  }
  
  return {
    success: errors.length === 0,
    appliedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Parse patch data to extract search and replace text
 */
function parsePatchData(patch: any): { search: string; replace: string } {
  if (typeof patch === 'string') {
    // Parse Aider format
    const match = patch.match(/<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/);
    if (match) {
      return {
        search: match[1],
        replace: match[2]
      };
    }
  }
  
  // If patch is an object with search/replace properties
  if (typeof patch === 'object' && patch !== null) {
    if ('search' in patch && 'replace' in patch) {
      return {
        search: String(patch.search),
        replace: String(patch.replace)
      };
    }
  }
  
  return { search: '', replace: '' };
}

/**
 * Create detailed error message for failed patch
 */
export function formatPatchError(error: ApplyError): string {
  let message = `Patch ${error.patchIndex}: ${error.message}`;
  
  if (error.suggestions && error.suggestions.length > 0) {
    message += '\n\nDid you mean one of these?';
    error.suggestions.forEach((suggestion, i) => {
      message += `\n${i + 1}. ${suggestion.substring(0, 100)}${suggestion.length > 100 ? '...' : ''}`;
    });
  }
  
  if (error.context) {
    message += `\n\nContext: ${error.context}`;
  }
  
  return message;
}
