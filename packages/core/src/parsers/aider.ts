/**
 * Aider format parser
 * Reference: IMPLEMENTATION_SPEC.md lines 616-625
 * Format: <<<SEARCH\n...\n===\n...\n>>>
 */

import type { ParsedPatch, Patch } from '../types.js';

const AIDER_PATTERN = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/g;

export function parseAiderFormat(text: string): { document: string; patches: ParsedPatch[] } {
  const patches: ParsedPatch[] = [];
  let cleanDocument = text;
  
  // Extract all patches
  let match;
  while ((match = AIDER_PATTERN.exec(text)) !== null) {
    const search = match[1];
    const replace = match[2];
    
    patches.push({
      search,
      replace,
      operation: detectOperation(search, replace)
    });
    
    // Remove patch markers from document
    cleanDocument = cleanDocument.replace(match[0], replace);
  }
  
  return { document: cleanDocument, patches };
}

export function serializeAiderFormat(patches: ParsedPatch[]): string {
  return patches.map(patch => 
    `<<<SEARCH\n${patch.search}\n===\n${patch.replace}\n>>>`
  ).join('\n\n');
}

export function formatAsPatch(search: string, replace: string): string {
  return `<<<SEARCH\n${search}\n===\n${replace}\n>>>`;
}

function detectOperation(search: string, replace: string): 'add' | 'change' | 'remove' {
  if (search.trim() === '' && replace.trim() !== '') {
    return 'add';
  } else if (search.trim() !== '' && replace.trim() === '') {
    return 'remove';
  } else {
    return 'change';
  }
}

export function createPatchId(search: string, replace: string): string {
  const content = `${search}|||${replace}`;
  // Simple hash function for browser compatibility
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'chg_' + Math.abs(hash).toString(36);
}
