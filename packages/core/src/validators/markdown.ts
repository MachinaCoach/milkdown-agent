/**
 * Markdown validation
 * Shared between frontend and backend
 */

import { remark } from 'remark';
import type { ValidationResult } from '../types.js';

/**
 * Validate markdown structure
 */
export function validateMarkdown(document: string): ValidationResult {
  try {
    const processor = remark();
    const ast = processor.parse(document);
    
    // Check for parsing errors
    // @ts-ignore - remark types don't expose errors properly
    if (ast.errors && ast.errors.length > 0) {
      return {
        valid: false,
        // @ts-ignore
        errors: ast.errors.map((e: any) => e.message)
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}
