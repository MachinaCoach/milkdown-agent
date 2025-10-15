/**
 * Mock backend that simulates AI responses
 * Stubs out LLM calls for testing
 */

import type { SyncSnapshot } from '@milkdown-agent/core';
import { parseAiderFormat, serializeAiderFormat } from '@milkdown-agent/core';

// Simulated server state
let serverVersion = 1;
let serverDocument = '';

/**
 * Mock AI that generates improvements
 */
function mockAI(document: string): string[] {
  const patches: string[] = [];
  
  // Example 1: Improve "hello" to "Hello"
  if (document.includes('hello') && !document.includes('Hello')) {
    patches.push(`<<<SEARCH
hello
===
Hello
>>>`);
  }
  
  // Example 2: Add emphasis to "important"
  if (document.includes('important') && !document.includes('**important**')) {
    patches.push(`<<<SEARCH
important
===
**important**
>>>`);
  }
  
  // Example 3: Fix "teh" typo
  if (document.includes('teh ')) {
    patches.push(`<<<SEARCH
teh 
===
the 
>>>`);
  }
  
  // Example 4: Suggest adding a period
  const lines = document.split('\n');
  for (const line of lines) {
    if (line.trim() && !line.trim().endsWith('.') && !line.trim().endsWith('!') && !line.trim().endsWith('?') && !line.startsWith('#')) {
      patches.push(`<<<SEARCH
${line}
===
${line}.
>>>`);
      break; // Only suggest one at a time
    }
  }
  
  return patches;
}

/**
 * Mock sync endpoint
 */
export async function mockSync(snapshot: SyncSnapshot): Promise<{
  ok: boolean;
  version?: number;
  patches?: string[];
  error?: string;
  serverDocument?: string;
  serverVersion?: number;
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Version check
  if (snapshot.version !== serverVersion) {
    return {
      ok: false,
      error: 'Version mismatch',
      serverDocument,
      serverVersion
    };
  }
  
  // Get current document
  let currentDoc = serverDocument;
  
  if (snapshot.documentWithPatches) {
    // Parse document with patches
    const parsed = parseAiderFormat(snapshot.documentWithPatches);
    currentDoc = parsed.document;
  }
  
  // Update server state
  serverDocument = currentDoc;
  
  // Generate AI suggestions
  const aiPatches = mockAI(currentDoc);
  
  // Increment version
  serverVersion++;
  
  return {
    ok: true,
    version: serverVersion,
    patches: aiPatches
  };
}

/**
 * Reset server state (for testing)
 */
export function resetMockBackend() {
  serverVersion = 1;
  serverDocument = '';
}

/**
 * Get server state (for debugging)
 */
export function getMockBackendState() {
  return {
    version: serverVersion,
    document: serverDocument
  };
}
