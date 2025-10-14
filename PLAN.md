# Milkdown Agent-Friendly Plugin Roadmap

This plan outlines the major milestones for delivering an open-source Milkdown plugin that enables agent-driven editing with a Node.js tooling backend, accompanied by a simple React demo and CodePen-powered README showcase.

> **Working Agreement**: we will keep iterating on this plan and the implementation workstreams until a shippable, agent-friendly Milkdown plugin and playable demo are complete. Each iteration below feeds the next, ensuring we pause only once the end-to-end experience is usable and ready to share.

## Iteration Loop Toward a Playable Plugin
- [ ] **Iteration 0 · Planning Refresh**
  - [ ] Validate scope, success criteria, and stakeholder expectations.
  - [ ] Capture outstanding questions or research spikes to unblock development.
- [x] **Iteration 1 · Plugin Skeleton**
  - [x] Scaffold Milkdown plugin package with build pipeline, storybook/docs playground, and placeholder commands.
  - [x] Render suggestion mark/node with mock data and static styles to validate UX direction.
- [x] **Iteration 2 · Agent Suggestion Flow**
  - [x] Wire commands to accept/reject mock suggestions and ensure read-only enforcement works in practice.
  - [x] Persist suggestion state and expose callback hooks (approve/reject) to consumers.
- [ ] **Iteration 3 · Backend Tool Integration**
  - [ ] Connect suggestion callbacks to diff tooling adapter (mock or real backend) behind a backend-agnostic contract.
  - [ ] Exercise end-to-end flow with scripted diffs to confirm the API remains transport-neutral.
- [ ] **Iteration 4 · Demo Hardening**
  - [ ] Integrate the plugin into the React demo with realistic agent scenarios and reset/undo flows.
  - [ ] Add telemetry/logging hooks to observe suggestion lifecycle for future improvements.
- [ ] **Iteration 5 · Release Candidate**
  - [ ] Run documentation, accessibility, and performance polish pass on plugin and demo.
  - [ ] Dry-run npm publish and CodePen embedding to verify distributable assets.


## Phase 0 · Foundations & Project Setup
- [x] Scaffold repository structure (packages for plugin, backend tools, demo, shared config).
- [ ] Define licensing, contribution guidelines, and code of conduct.
- [ ] Establish TypeScript, linting, formatting, and testing baselines across workspaces.

## Phase 1 · Milkdown Suggestion Plugin
- [x] Research Milkdown context APIs for read-only configuration and transaction control.
- [x] Design suggestion schema (inline node/mark with `data-diff-suggestion` attributes mirroring Tiptap diff-suggestions).
- [x] Implement command set (`applySuggestion`, `rejectSuggestion`, batch accept/reject) with transaction safety.
- [x] Add styling primitives for inline diff visualization (strikethrough, highlight, metadata badges).
- [x] Provide plugin options for suggestion metadata (comments, rule tags, multiple replacements).
- [ ] Write unit/integration tests validating command behavior and read-only enforcement.
- [ ] Document public API, usage examples, and migration notes from Tiptap patterns.

## Phase 2 · Agent Tooling Backend (Node.js)
- [ ] Specify JSON/XML schema for agent tool invocations (`read_file`, `apply_diff`).
- [ ] Port/implement diff application logic inspired by Cline (`constructNewFileContent`) with robust matching strategies.
- [ ] Implement error handling & reporting for unfound search blocks and partial diff failures.
- [ ] Add optional line-number metadata validation.
- [ ] Provide CLI and HTTP endpoints for invoking tools from local or remote agents.
- [ ] Create automated tests covering happy-path and edge-case diffs.
- [ ] Publish backend tooling package to npm with TypeScript typings.

## Phase 3 · Frontend-Backend Integration
- [ ] Define data contract for suggestions (IDs, ranges, old/new text, metadata, status flags).
- [ ] Keep the integration contract backend-agnostic so implementers can choose REST, WebSockets, or other transports without API coupling.
- [ ] Implement transport layer (WebSocket/REST) to push agent suggestions into the editor plugin.
- [ ] Wire suggestion acceptance/rejection to backend `apply_diff` and state synchronization.
- [ ] Track rejected suggestion IDs to prevent repeated prompts.
- [ ] Add optimistic UI updates with rollback on backend failure.
- [ ] Validate undo/redo flows and history plugin interoperability.

## Phase 4 · Demo React Application
- [x] Scaffold minimal React app demonstrating the plugin in read-only mode with agent suggestions.
- [x] Mock backend agent responses to showcase suggestion lifecycle without external services.
- [x] Include controls for simulating incoming diffs, approvals, rejections, and history navigation.
- [x] Style demo for clarity (light instructions, suggestion legend, responsive layout).
- [x] Integrate demo build into repository workspace and ensure it can be deployed (e.g., Vite).

## Phase 5 · Documentation & Community Assets
- [x] Author README with project overview, architecture diagram, and quickstart instructions.
- [x] Embed CodePen example showing the plugin in action with inline suggestions.
- [ ] Publish API reference docs (typedoc or mdx) for plugin and backend packages.
- [ ] Provide agent prompt guidelines referencing Cline/Roo diff best practices.
- [ ] Record and link short screencast or animated GIF from demo.
- [ ] Outline roadmap for future enhancements (multi-option suggestions, comment threads, real-time agents).

## Phase 6 · Release & Distribution
- [ ] Configure automated builds and tests via CI.
- [ ] Set up npm publishing workflow (changesets or semantic-release) for all packages.
- [ ] Create versioned changelog and release notes template.
- [ ] Coordinate announcement strategy (blog post, social channels, community forums).

## Success Criteria
- [ ] Plugin published to npm with documented API and usage.
- [ ] Backend tooling package published to npm with working diff commands.
- [ ] Demo React app runnable locally and deployed as CodePen example embedded in README.
- [ ] Positive developer feedback from initial adopters (issue tracker, discussions, or testimonials).

