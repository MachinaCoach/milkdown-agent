import { $view } from '@milkdown/utils';
import type { SuggestionAttrs } from '../types';
import { agentSuggestionNode } from './node';
import { acceptSuggestionCommand } from '../commands/accept';
import { rejectSuggestionCommand } from '../commands/reject';

/**
 * NodeView for rendering suggestions with inline accept/reject buttons
 */
export const suggestionNodeView = $view(agentSuggestionNode, () => {
  return (node, view, getPos) => {
    const dom = document.createElement('span');
    dom.className = 'agent-suggestion';
    dom.setAttribute('data-agent-suggestion', 'true');
    dom.setAttribute('data-suggestion-id', node.attrs.id);
    
    const { id, oldText, newText, metadata } = node.attrs as SuggestionAttrs;
    
    // Old text (strikethrough)
    const oldSpan = document.createElement('span');
    oldSpan.className = 'agent-suggestion__old';
    oldSpan.textContent = oldText;
    oldSpan.setAttribute('data-agent-suggestion-old', 'true');
    
    // New text (highlighted)
    const newSpan = document.createElement('span');
    newSpan.className = 'agent-suggestion__new';
    newSpan.textContent = newText;
    newSpan.setAttribute('data-agent-suggestion-new', 'true');
    
    // Controls container
    const controls = document.createElement('span');
    controls.className = 'agent-suggestion__controls';
    
    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'agent-suggestion__btn agent-suggestion__btn--accept';
    acceptBtn.textContent = '✓';
    acceptBtn.title = 'Accept suggestion';
    acceptBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestionCommand.run(id);
    };
    
    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'agent-suggestion__btn agent-suggestion__btn--reject';
    rejectBtn.textContent = '✕';
    rejectBtn.title = 'Reject suggestion';
    rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      rejectSuggestionCommand.run(id);
    };
    
    controls.appendChild(acceptBtn);
    controls.appendChild(rejectBtn);
    
    dom.appendChild(oldSpan);
    dom.appendChild(newSpan);
    dom.appendChild(controls);
    
    return {
      dom,
      contentDOM: null,
      update: () => false,
      destroy: () => {},
    };
  };
});
