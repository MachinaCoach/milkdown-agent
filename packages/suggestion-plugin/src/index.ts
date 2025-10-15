/**
 * @milkdown-agent/suggestion-plugin
 *
 * Milkdown plugin for AI-assisted editing with Windsurf-like UX
 *
 * Features:
 * - User edit tracking (creates patches from typing)
 * - Visual diff overlays for all changes (AI + user)
 * - Accept/reject controls for each patch
 * - Callback-based flush for syncing with backend
 * - Supports patch mode and full document mode
 *
 * @example
 * ```ts
 * import { agentSuggestion, agentCommands } from '@milkdown-agent/suggestion-plugin';
 *
 * editor.use(agentSuggestion({
 *   onPatchAccepted: (patch) => console.log('Accepted:', patch),
 *   onPatchRejected: (patch, reason) => console.log('Rejected:', patch, reason),
 *   onPatchesChanged: (patches) => console.log('Patches:', patches)
 * }));
 *
 * // Sync with backend
 * await editor.action(agentCommands.flush(async (snapshot, success, failure) => {
 *   const response = await fetch('/api/sync', { body: JSON.stringify(snapshot) });
 *   const data = await response.json();
 *   if (data.ok) {
 *     success(data.patches);
 *   } else {
 *     failure(data.error);
 *   }
 * }));
 * ```
 */

export { agentSuggestion, agentCommands } from './agentPlugin.js';
export type { AgentPluginConfig } from './agentPlugin.js';
export type { Patch, SyncFunction, ChangeFormat, SyncSnapshot, FlushResult } from '@milkdown-agent/core';

// Command keys (for advanced usage)
export { InsertSuggestion } from './commands/insert';
export { AcceptSuggestion } from './commands/accept';
export { RejectSuggestion } from './commands/reject';
export { AcceptAllSuggestions, RejectAllSuggestions } from './commands/batch';
