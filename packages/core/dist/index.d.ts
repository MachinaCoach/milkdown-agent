/**
 * Core types for Milkdown Agent
 * Reference: IMPLEMENTATION_SPEC.md lines 98-151
 */
interface Patch<T = string> {
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
interface SyncSnapshot {
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
interface FlushResult {
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
interface ApplyResult {
    /** Overall success */
    success: boolean;
    /** How many patches applied successfully */
    appliedCount?: number;
    /** Detailed errors for failed patches */
    errors?: ApplyError[];
}
interface ApplyError {
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
type RejectReason = 'explicit' | 'modified' | 'deleted' | 'conflict';
type SyncFunction<T> = (snapshot: SyncSnapshot, success: (patchesOrDocument?: T[] | string, version?: number) => void, failure: (error: string, serverDocument?: string, serverVersion?: number) => void) => Promise<void> | void;
type ChangeFormat = 'aider' | 'anthropic' | 'unified-diff';
interface ValidationResult {
    valid: boolean;
    errors?: string[];
}
interface ParsedPatch {
    search: string;
    replace: string;
    operation: 'add' | 'change' | 'remove';
}

/**
 * Aider format parser
 * Reference: IMPLEMENTATION_SPEC.md lines 616-625
 * Format: <<<SEARCH\n...\n===\n...\n>>>
 */

declare function parseAiderFormat(text: string): {
    document: string;
    patches: ParsedPatch[];
};
declare function serializeAiderFormat(patches: ParsedPatch[]): string;
declare function formatAsPatch(search: string, replace: string): string;
declare function createPatchId(search: string, replace: string): string;

/**
 * Markdown validation
 * Shared between frontend and backend
 */

/**
 * Validate markdown structure
 */
declare function validateMarkdown(document: string): ValidationResult;

export { type ApplyError, type ApplyResult, type ChangeFormat, type FlushResult, type ParsedPatch, type Patch, type RejectReason, type SyncFunction, type SyncSnapshot, type ValidationResult, createPatchId, formatAsPatch, parseAiderFormat, serializeAiderFormat, validateMarkdown };
