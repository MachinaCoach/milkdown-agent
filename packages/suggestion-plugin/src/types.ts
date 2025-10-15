/**
 * Attributes stored in a suggestion node
 */
export type SuggestionAttrs = {
  id: string;
  oldText: string;
  newText: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Payload for inserting a new suggestion
 */
export type InsertSuggestionPayload = {
  id: string;
  from: number;
  to: number;
  newText: string;
  oldText?: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Snapshot of a suggestion with its position in the document
 */
export type SuggestionSnapshot = SuggestionAttrs & { pos: number };

/**
 * Callbacks for suggestion lifecycle events
 */
export type SuggestionCallbacks = {
  onSuggestionCreated?: (suggestion: SuggestionSnapshot) => void;
  onSuggestionAccepted?: (suggestion: SuggestionSnapshot) => void;
  onSuggestionRejected?: (suggestion: SuggestionSnapshot) => void;
  onSuggestionsChanged?: (suggestions: SuggestionSnapshot[]) => void;
};
