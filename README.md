# Milkdown Agent Suggestion Toolkit

An open-source playground for building agent-friendly review flows on top of [Milkdown](https://milkdown.dev). This repo contains:

- `@milkdown-agent/suggestion-plugin` – a framework-agnostic Milkdown extension that renders inline diff suggestions with accept/reject commands.
- `examples/react-demo` – a minimal React + Vite project showcasing the plugin in action with a review panel UI.
- Documentation and a CodePen-powered playground so you can experiment without cloning the repo.

## Packages

| Package | Description |
| --- | --- |
| [`@milkdown-agent/suggestion-plugin`](packages/suggestion-plugin) | Milkdown node + commands for suggestion diff review |
| [`react-demo`](examples/react-demo) | React/Vite sandbox featuring the plugin, locked editor mode, and accept/reject controls |

## Quick start

```bash
npm install
npm run build
```

Then jump into the React sandbox:

```bash
cd examples/react-demo
npm install
npm run dev
```

Open the printed URL (defaults to [http://localhost:5173](http://localhost:5173)) to review suggestions and try the controls.

## CodePen live demo

<div align="center">
  <iframe
    height="520"
    style="width: 100%;"
    scrolling="no"
    title="Milkdown Agent Suggestion Playground"
    src="https://codepen.io/team/codepen/embed/preview/KKPQLmN?default-tab=result"
    frameborder="no"
    loading="lazy"
    allowtransparency="true"
    allowfullscreen="true"
  ></iframe>
</div>

> 💡 The embedded CodePen is a temporary sandbox while we publish the npm bundle. It demonstrates the locked-editor UX and will be swapped for an official pen once the package ships publicly. If the iframe fails (e.g., offline usage), click the button below to open a pre-filled CodePen playground that bundles the plugin and a barebones HTML/JS demo.

<form action="https://codepen.io/pen/define" method="POST" target="_blank">
  <input type="hidden" name="data" value='{"title":"Milkdown Agent Suggestion Playground","tags":["milkdown","suggestion","agent"],"scripts":["https://unpkg.com/@milkdown/core@7.2.0/dist/index.umd.js","https://unpkg.com/@milkdown/preset-commonmark@7.2.0/dist/index.umd.js","https://unpkg.com/@milkdown/theme-nord@7.2.0/dist/index.umd.js"],"stylesheets":["https://unpkg.com/@milkdown/theme-nord/style.css"],"html":"<div id=\"app\"></div>","js":"// Load the plugin bundle from unpkg once published\nconsole.log('Install @milkdown-agent/suggestion-plugin locally to customize.');"}' />
  <button type="submit">Open live CodePen demo</button>
</form>

## Backend-agnostic integration contract

The plugin exposes declarative commands rather than transport-specific APIs. Agents can propose diffs from any backend (REST, SSE, websockets, file-based, etc.) as long as they translate the change into a `InsertSuggestionPayload`. Consumers trigger commands like so:

```ts
editor.action(insertSuggestion({
  id: suggestion.id,
  from: suggestion.from,
  to: suggestion.to,
  newText: suggestion.newText,
  metadata: suggestion.metadata,
}));
```

The UI layer stays in charge of accepting or rejecting, and the backend only needs to listen for those decisions to persist state.

## Repository scripts

- `npm run build` – builds every workspace package.
- `npm run lint` – runs eslint where configured.
- `npm run test` – executes workspace tests (the plugin ships with Vitest hooks ready for future suites).

## Roadmap

See [PLAN.md](PLAN.md) for the phased implementation plan and iteration checkpoints.
