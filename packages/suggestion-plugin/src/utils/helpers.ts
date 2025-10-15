import type { Ctx } from '@milkdown/ctx';
import { editorViewOptionsCtx } from '@milkdown/core';
import type { InsertSuggestionPayload } from '../types';
import { insertSuggestionCommand } from '../commands/insert';
import { acceptSuggestionCommand } from '../commands/accept';
import { rejectSuggestionCommand } from '../commands/reject';
import { acceptAllSuggestionsCommand, rejectAllSuggestionsCommand } from '../commands/batch';

/**
 * Helper that forces the editor into read-only mode
 */
export const lockEditor = (ctx: Ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => false,
  }));
};

/**
 * Helper to unlock the editor for manual typing
 */
export const unlockEditor = (ctx: Ctx) => {
  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: () => true,
  }));
};

/**
 * Utility to dispatch a suggestion insertion via Editor.action
 */
export const insertSuggestion = (payload: InsertSuggestionPayload) => (ctx: Ctx) => {
  return insertSuggestionCommand.run(payload);
};

/**
 * Utility to accept a suggestion
 */
export const acceptSuggestion = (id: string) => (ctx: Ctx) => {
  return acceptSuggestionCommand.run(id);
};

/**
 * Utility to reject a suggestion
 */
export const rejectSuggestion = (id: string) => (ctx: Ctx) => {
  return rejectSuggestionCommand.run(id);
};

/**
 * Utility to accept all suggestions
 */
export const acceptAllSuggestions = () => (ctx: Ctx) => {
  return acceptAllSuggestionsCommand.run();
};

/**
 * Utility to reject all suggestions
 */
export const rejectAllSuggestions = () => (ctx: Ctx) => {
  return rejectAllSuggestionsCommand.run();
};
