import { useState } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { nord } from '@milkdown/theme-nord';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { agentSuggestion, agentCommands } from '@milkdown-agent/suggestion-plugin';
import type { Patch } from '@milkdown-agent/core';
import { mockSync, getMockBackendState } from './mockBackend';
import '@milkdown/theme-nord/style.css';
import '@milkdown-agent/suggestion-plugin/style.css';
import './App.css';

const initialMarkdown = `# Welcome to Milkdown Agent Demo

This is a demo of the agent suggestion plugin with user edit tracking.

Try typing something - your edits will be tracked as patches!

Some text with teh typo and hello world.

This is important information

Try editing this text and watch the patches appear`;

function MilkdownEditor() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialMarkdown);
      })
      .use(nord)
      .use(commonmark)
      .use(agentSuggestion({
        onPatchAccepted: (patch) => {
          console.log('✓ Accepted:', patch);
          setPatches(agentCommands.getPatches());
        },
        onPatchRejected: (patch, reason) => {
          console.log('✗ Rejected:', patch, reason);
          setPatches(agentCommands.getPatches());
        },
        onPatchesChanged: (newPatches) => {
          console.log('Patches changed:', newPatches);
          setPatches(newPatches);
        }
      }))
  );
  
  const handleSync = async () => {
    setSyncing(true);
    setLastSync('Syncing...');
    
    try {
      const result = await agentCommands.flush(async (snapshot, success, failure) => {
        console.log('Sending snapshot:', snapshot);
        
        const response = await mockSync(snapshot);
        console.log('Backend response:', response);
        
        if (response.ok && response.patches) {
          success(response.patches, response.version);
        } else {
          failure(
            response.error || 'Unknown error',
            response.serverDocument,
            response.serverVersion
          );
        }
      });
      
      if (result.success) {
        setLastSync(`✓ Synced at version ${result.version}`);
        setPatches(agentCommands.getPatches());
      } else {
        setLastSync(`✗ Sync failed: ${result.error}`);
      }
    } catch (error) {
      setLastSync(`✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setSyncing(false);
    }
  };
  
  const handleAcceptAll = () => {
    agentCommands.acceptAllPatches();
    setPatches(agentCommands.getPatches());
  };
  
  const handleRejectAll = () => {
    agentCommands.rejectAllPatches();
    setPatches(agentCommands.getPatches());
  };
  
  return (
    <div className="editor-container">
      <div className="toolbar">
        <button 
          onClick={handleSync} 
          disabled={syncing}
          className="sync-btn"
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync with AI'}
        </button>
        
        <button 
          onClick={handleAcceptAll}
          disabled={patches.length === 0}
          className="accept-all-btn"
        >
          ✓ Accept All ({patches.length})
        </button>
        
        <button 
          onClick={handleRejectAll}
          disabled={patches.length === 0}
          className="reject-all-btn"
        >
          ✗ Reject All
        </button>
        
        <span className="sync-status">{lastSync}</span>
      </div>
      
      <Milkdown />
      
      <div className="sidebar">
        <h3>Active Patches ({patches.length})</h3>
        <div className="patches-list">
          {patches.length === 0 ? (
            <p className="no-patches">No patches yet. Try typing or click "Sync with AI"!</p>
          ) : (
            patches.map((patch) => (
              <div key={patch.id} className="patch-item">
                <div className="patch-header">
                  <span className={`patch-badge patch-badge--${patch.operation}`}>
                    {patch.operation}
                  </span>
                  <span className={`patch-source patch-source--${patch.source}`}>
                    {patch.source === 'inline' ? '👤 User' : '🤖 AI'}
                  </span>
                </div>
                <pre className="patch-data">{patch.data.substring(0, 100)}...</pre>
                <div className="patch-actions">
                  <button 
                    onClick={() => {
                      agentCommands.acceptPatch(patch.id);
                      setPatches(agentCommands.getPatches());
                    }}
                    className="patch-btn patch-btn--accept"
                  >
                    ✓ Accept
                  </button>
                  <button 
                    onClick={() => {
                      agentCommands.rejectPatch(patch.id);
                      setPatches(agentCommands.getPatches());
                    }}
                    className="patch-btn--reject"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="debug-info">
          <h4>Debug Info</h4>
          <pre>{JSON.stringify(getMockBackendState(), null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MilkdownProvider>
      <div className="app">
        <header className="app-header">
          <h1>🎯 Milkdown Agent Demo</h1>
          <p>AI-assisted editing with user edit tracking (Windsurf-like UX)</p>
        </header>
        <MilkdownEditor />
      </div>
    </MilkdownProvider>
  );
}
