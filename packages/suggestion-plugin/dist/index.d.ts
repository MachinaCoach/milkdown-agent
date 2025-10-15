import * as _milkdown_core from '@milkdown/core';
import { MilkdownPlugin, Ctx } from '@milkdown/ctx';
import { Node } from '@milkdown/prose/model';

type SuggestionAttrs = {
    id: string;
    oldText: string;
    newText: string;
    metadata?: Record<string, unknown> | null;
};
type InsertSuggestionPayload = {
    id: string;
    from: number;
    to: number;
    newText: string;
    oldText?: string;
    metadata?: Record<string, unknown> | null;
};
type SuggestionDecision = {
    id: string;
    accepted: boolean;
    oldText: string;
    newText: string;
};
declare const InsertSuggestion: _milkdown_core.CmdKey<InsertSuggestionPayload>;
declare const AcceptSuggestion: _milkdown_core.CmdKey<string>;
declare const RejectSuggestion: _milkdown_core.CmdKey<string>;
declare const AcceptAllSuggestions: _milkdown_core.CmdKey<undefined>;
declare const RejectAllSuggestions: _milkdown_core.CmdKey<undefined>;
/**
 * Register the suggestion node and supporting commands.
 */
declare const agentSuggestion: () => MilkdownPlugin[];
/**
 * Helper that forces the editor into read-only mode so only programmatic actions modify content.
 */
declare const lockEditor: (ctx: Ctx) => void;
/**
 * Helper to unlock the editor for manual typing, e.g. for debugging.
 */
declare const unlockEditor: (ctx: Ctx) => void;
type SuggestionSnapshot = SuggestionAttrs & {
    pos: number;
};
/**
 * Collect all suggestions currently in the document.
 */
declare const collectSuggestions: (doc: Node) => SuggestionSnapshot[];
/**
 * Utility to dispatch a suggestion insertion via Editor.action without importing command keys.
 */
declare const insertSuggestion: (payload: InsertSuggestionPayload) => (ctx: Ctx) => boolean;
declare const acceptSuggestion: (id: string) => (ctx: Ctx) => boolean;
declare const rejectSuggestion: (id: string) => (ctx: Ctx) => boolean;
declare const acceptAllSuggestions: () => (ctx: Ctx) => boolean;
declare const rejectAllSuggestions: () => (ctx: Ctx) => boolean;

export { AcceptAllSuggestions, AcceptSuggestion, InsertSuggestion, type InsertSuggestionPayload, RejectAllSuggestions, RejectSuggestion, type SuggestionAttrs, type SuggestionDecision, type SuggestionSnapshot, acceptAllSuggestions, acceptSuggestion, agentSuggestion, collectSuggestions, insertSuggestion, lockEditor, rejectAllSuggestions, rejectSuggestion, unlockEditor };
