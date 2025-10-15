/**
 * Core types for Milkdown Agent
 * Reference: IMPLEMENTATION_SPEC.md lines 98-151
 */

export interface Patch<T = string> {
  /** Hash-based stable ID (no server coordination needed) */
  id: string;
  
  /** Wire format data (e.g., "<<<SEARCH\n...\n===\n...\n>>>") */
  data: T;
  
  /** Type of operation */
  operation: 'add' | 'change' | 'remove';
  
  /** Source of patch:
   * - 'instrumented': From applyPatches() (AI-generated)
   * - 'inline': From user typing (user edit tracking)
   */
  source: 'instrumented' | 'inline';
  
  /** Position in document */
  position: number;
  
  /** Optional section identifier */
  section?: string;
}

export interface SyncSnapshot {
  /** Current version (before increment) */
  version: number;
  
  /** User edited document (not just patches) */
  hasDocumentChanges: boolean;
  
  /** Patches were added/accepted/rejected */
  hasPatchChanges: boolean;
  
  /** Full document with patches inline (if hasDocumentChanges) */
  documentWithPatches?: string;
  
  /** Serialized patches (if hasPatchChanges) */
  patches?: string[];
  
  /** IDs of accepted patches */
  acceptedPatches?: string[];
  
  /** IDs of rejected patches */
  rejectedPatches?: string[];
  
  /** IDs of newly applied patches */
  newPatches?: string[];
}

export interface FlushResult {
  /** Did flush succeed? */
  success: boolean;
  
  /** New version (if success) */
  version?: number;
  
  /** Error message (if failure) */
  error?: string;
  
  /** Server's version (if error, for debugging) */
  serverVersion?: number;
  
  /** Server's document (if error, for recovery) */
  serverDocument?: string;
}

export interface ApplyResult {
  /** Overall success */
  success: boolean;
  
  /** How many patches applied successfully */
  appliedCount?: number;
  
  /** Detailed errors for failed patches */
  errors?: ApplyError[];
}

export interface ApplyError {
  /** Error type */
  type: 'parse' | 'match' | 'invalid_markdown' | 'position' | 'conflict' | 'ambiguous';
  
  /** Error message */
  message: string;
  
  /** Index of failed patch */
  patchIndex?: number;
  
  /** Patch data that failed */
  patchData?: any;
  
  /** Suggestions for "did you mean" errors */
  suggestions?: string[];
  
  /** Surrounding text for debugging */
  context?: string;
}

export type RejectReason = 'explicit' | 'modified' | 'deleted' | 'conflict';

export type SyncFunction<T> = (
  snapshot: SyncSnapshot,
  success: (patchesOrDocument?: T[] | string, version?: number) => void,
  failure: (error: string, serverDocument?: string, serverVersion?: number) => void
) => Promise<void> | void;

export type ChangeFormat = 'aider' | 'anthropic' | 'unified-diff';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ParsedPatch {
  search: string;
  replace: string;
  operation: 'add' | 'change' | 'remove';
}
