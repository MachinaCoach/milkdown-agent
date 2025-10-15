import { $ctx } from '@milkdown/utils';
import type { SuggestionCallbacks } from './types';

/**
 * Context key for storing suggestion callbacks
 */
export const suggestionCallbacksCtx = $ctx<SuggestionCallbacks, 'suggestionCallbacks'>({}, 'suggestionCallbacks');
