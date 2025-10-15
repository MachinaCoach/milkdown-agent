import { MilkdownPlugin } from '@milkdown/ctx';
import { ChangeFormat, Patch, SyncFunction, FlushResult } from '@milkdown-agent/core';
export { ChangeFormat, FlushResult, Patch, SyncFunction, SyncSnapshot } from '@milkdown-agent/core';
import * as _milkdown_core from '@milkdown/core';

/**
 * Main Milkdown Agent Plugin
 * Provides Windsurf-like AI-assisted editing with user edit tracking
 */

interface AgentPluginConfig<T = string> {
    /** Change format (default: 'aider') */
    changeFormat?: ChangeFormat;
    /** Callbacks */
    onPatchAccepted?: (patch: Patch<T>) => void;
    onPatchRejected?: (patch: Patch<T>, reason: string) => void;
    onPatchesChanged?: (patches: Patch<T>[]) => void;
}
/**
 * Create the agent suggestion plugin
 */
declare function agentSuggestion<T = string>(config?: AgentPluginConfig<T>): MilkdownPlugin;
/**
 * Plugin commands (exported for use in editor)
 * These can be called directly without Milkdown context
 */
declare const agentCommands: {
    /**
     * Flush with sync
     */
    flush: <T>(syncFn: SyncFunction<T>) => Promise<FlushResult>;
    /**
     * Simple flush (no sync)
     */
    simpleFlush: () => void;
    /**
     * Accept a patch
     */
    acceptPatch: (patchId: string) => boolean;
    /**
     * Reject a patch
     */
    rejectPatch: (patchId: string) => boolean;
    /**
     * Accept all patches
     */
    acceptAllPatches: () => void;
    /**
     * Reject all patches
     */
    rejectAllPatches: () => void;
    /**
     * Get current patches
     */
    getPatches: <T = string>() => Patch<T>[];
    /**
     * Get current version
     */
    getVersion: () => number;
};

/**
 * Payload for inserting a new suggestion
 */
type InsertSuggestionPayload = {
    id: string;
    from: number;
    to: number;
    newText: string;
    oldText?: string;
    metadata?: Record<string, unknown> | null;
};

declare const InsertSuggestion: _milkdown_core.CmdKey<InsertSuggestionPayload>;

declare const AcceptSuggestion: _milkdown_core.CmdKey<string>;

declare const RejectSuggestion: _milkdown_core.CmdKey<string>;

declare const AcceptAllSuggestions: _milkdown_core.CmdKey<undefined>;
declare const RejectAllSuggestions: _milkdown_core.CmdKey<undefined>;

export { AcceptAllSuggestions, AcceptSuggestion, type AgentPluginConfig, InsertSuggestion, RejectAllSuggestions, RejectSuggestion, agentCommands, agentSuggestion };
