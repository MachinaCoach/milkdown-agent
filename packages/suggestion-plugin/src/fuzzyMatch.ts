/**
 * Progressive fuzzy matching for patches
 * Reference: START_HERE.md lines 292-317, EDGE_CASES.md lines 215-236
 * 
 * Strategy: Try multiple matching strategies in order:
 * 1. Exact match
 * 2. Ignore trailing whitespace
 * 3. Ignore all whitespace
 * 4. Fuzzy match with similarity score
 */

import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export interface MatchResult {
  success: boolean;
  position?: number;
  score?: number;
  error?: string;
  suggestions?: string[];
  context?: string;
}

/**
 * Apply patch with progressive fuzzy matching
 */
export function applyWithFuzzyMatching(
  searchText: string,
  replaceText: string,
  document: string
): MatchResult {
  // 1. Try exact match
  let result = exactMatch(searchText, document);
  if (result.success) {
    return result;
  }
  
  // 2. Try ignoring trailing whitespace
  result = matchIgnoringTrailingWhitespace(searchText, document);
  if (result.success) {
    return result;
  }
  
  // 3. Try ignoring all whitespace
  result = matchIgnoringWhitespace(searchText, document);
  if (result.success) {
    return result;
  }
  
  // 4. Try fuzzy match
  result = fuzzyMatch(searchText, document);
  if (result.success && result.score && result.score > 0.8) {
    return result;
  }
  
  // All strategies failed
  return {
    success: false,
    error: 'No match found',
    suggestions: result.suggestions,
    context: result.context
  };
}

/**
 * Strategy 1: Exact match
 */
function exactMatch(searchText: string, document: string): MatchResult {
  const index = document.indexOf(searchText);
  
  if (index !== -1) {
    return {
      success: true,
      position: index,
      score: 1.0
    };
  }
  
  return { success: false };
}

/**
 * Strategy 2: Match ignoring trailing whitespace
 */
function matchIgnoringTrailingWhitespace(
  searchText: string,
  document: string
): MatchResult {
  const searchLines = searchText.split('\n').map(line => line.trimEnd());
  const docLines = document.split('\n');
  
  // Try to find matching sequence of lines
  for (let i = 0; i <= docLines.length - searchLines.length; i++) {
    let matches = true;
    
    for (let j = 0; j < searchLines.length; j++) {
      if (docLines[i + j].trimEnd() !== searchLines[j]) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      // Calculate position
      const position = docLines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      return {
        success: true,
        position,
        score: 0.95
      };
    }
  }
  
  return { success: false };
}

/**
 * Strategy 3: Match ignoring all whitespace
 */
function matchIgnoringWhitespace(
  searchText: string,
  document: string
): MatchResult {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
  
  const normalizedSearch = normalizeWhitespace(searchText);
  const normalizedDoc = normalizeWhitespace(document);
  
  const index = normalizedDoc.indexOf(normalizedSearch);
  
  if (index !== -1) {
    // Find approximate position in original document
    // This is a simplified approach
    const position = Math.floor((index / normalizedDoc.length) * document.length);
    
    return {
      success: true,
      position,
      score: 0.85
    };
  }
  
  return { success: false };
}

/**
 * Strategy 4: Fuzzy match using diff-match-patch
 */
function fuzzyMatch(searchText: string, document: string): MatchResult {
  // Use diff-match-patch's match function
  const matchLocation = dmp.match_main(document, searchText, 0);
  
  if (matchLocation !== -1) {
    // Calculate similarity score
    const actualText = document.substring(matchLocation, matchLocation + searchText.length);
    const diffs = dmp.diff_main(searchText, actualText);
    const levenshtein = dmp.diff_levenshtein(diffs);
    const score = 1 - (levenshtein / Math.max(searchText.length, actualText.length));
    
    if (score > 0.8) {
      return {
        success: true,
        position: matchLocation,
        score
      };
    }
  }
  
  // Find similar text for suggestions
  const suggestions = findSimilarText(searchText, document);
  
  return {
    success: false,
    suggestions,
    context: suggestions.length > 0 ? 'Did you mean one of these?' : 'No similar text found'
  };
}

/**
 * Find similar text in document for "did you mean" suggestions
 */
function findSimilarText(searchText: string, document: string, maxSuggestions = 3): string[] {
  const suggestions: Array<{ text: string; score: number }> = [];
  const searchLength = searchText.length;
  
  // Sample chunks of similar length from document
  for (let i = 0; i < document.length - searchLength; i += Math.floor(searchLength / 2)) {
    const chunk = document.substring(i, i + searchLength);
    
    // Calculate similarity
    const diffs = dmp.diff_main(searchText, chunk);
    const levenshtein = dmp.diff_levenshtein(diffs);
    const score = 1 - (levenshtein / searchLength);
    
    if (score > 0.5) {
      suggestions.push({ text: chunk, score });
    }
  }
  
  // Sort by score and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(s => s.text);
}

/**
 * Apply replacement at position
 */
export function applyReplacement(
  document: string,
  position: number,
  searchLength: number,
  replaceText: string
): string {
  return (
    document.substring(0, position) +
    replaceText +
    document.substring(position + searchLength)
  );
}
