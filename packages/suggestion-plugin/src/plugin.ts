import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import type { SuggestionCallbacks } from './types';
import { suggestionCallbacksCtx } from './context';
import { agentSuggestionNode } from './schema/node';
import { suggestionNodeView } from './schema/view';
import { insertSuggestionCommand } from './commands/insert';
import { acceptSuggestionCommand } from './commands/accept';
import { rejectSuggestionCommand } from './commands/reject';
import { acceptAllSuggestionsCommand, rejectAllSuggestionsCommand } from './commands/batch';

/**
 * Main plugin that registers the suggestion node and all commands
 */
export const agentSuggestion = (callbacks?: SuggestionCallbacks): MilkdownPlugin[] => [
  suggestionCallbacksCtx,
  agentSuggestionNode,
  suggestionNodeView,
  insertSuggestionCommand,
  acceptSuggestionCommand,
  rejectSuggestionCommand,
  acceptAllSuggestionsCommand,
  rejectAllSuggestionsCommand,
  (ctx: Ctx) => () => {
    if (callbacks) {
      ctx.set(suggestionCallbacksCtx.key, callbacks);
    }
  },
];
