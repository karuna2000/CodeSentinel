# CodeSentinel v2 — Development Plan (Automated Codebase Wikipedia Pivot)

## Current State & The Pivot
CodeSentinel is pivoting from a point-in-time code review tool into an **Automated Codebase Wikipedia and Onboarding Agent**. 

**What exists that we reuse:**
- `src/features/version-grounding/` — framework version inference. Repurposed to annotate Wiki pages with version-mismatched API warnings.

---

## Architecture: The Codebase Wikipedia

```
  GitHub App (Read-Only)
        │
        ▼
  Repository Indexer ──→ PostgreSQL (Neon)
        │
        ▼
  Code Intelligence Layer (AST + Symbols + Behavioral Edges)
        │
        ▼
  Repository Graph
        │
        ▼
  Context Planner ⭐
  ├── Intent Detection (Exploratory, Data Flow, Locational)
  ├── Hybrid Retrieval (Graph + BM25 + Embeddings)
  ├── Diagram Type Selection (Sequence, ER, Flowchart)
  └── Token Budget Manager
        │
        ▼
  LLM (Streaming)
        │
        ▼
  Primary: Auto-Generated Wiki & Mermaid Diagrams
  Secondary: Interactive Graph-Aware Chatbot (with write-back)
```

---

## Milestone 1: Repository Indexer

**Goal:** Connect to repositories securely and pull initial structural data.

### Deliverables
- GitHub App integration (not OAuth App) for per-repo installation scoping.
- Permissions: `Contents:read` + `Metadata:read` only. No write scopes required.
- Repository browser (list, search, filter by language).
- Initial seeding: parse `README.md` and existing docs.
- Incremental sync (delta updates, not full re-index).

---

## Milestone 2: Code Intelligence

**Goal:** Understand source code structure and behavioral relationships — AST parsing, symbol extraction, repository graph.

### Deliverables
- AST parsing for TS/JS/Python via Tree-sitter (WASM).
- Symbol extraction: functions, classes, interfaces, types, components, routes.
- **Focus:** Strong emphasis on extracting cross-file dependencies (imports, exports, class inheritance, API route definitions).
- **Behavioral edges (new):** Resolve runtime relationships beyond static imports — store reads/writes (e.g. `useStore()` → which store), API route → DB model calls, `fetch` calls → resolved route handlers.

### Database Schema Addition (Graph)
- `GraphNode` (Type: REPO, FOLDER, FILE, FUNCTION, CLASS, ROUTE, etc.)
- `GraphEdge` (Type: IMPORTS, CALLS, INHERITS, READS_STORE, FETCHES_ROUTE)

---

## Milestone 3: Context Engine ⭐

**Goal:** Retrieve optimal architectural context from the repository to generate documentation and answer questions.

### Deliverables
- **Intent Detection Updates:** Shift from "Security/Performance" to intents like:
    - `Exploratory` ("Explain how auth works")
    - `Data Flow` ("Trace the path of a user registration")
    - `Locational` ("Where is the Stripe webhook handler?")
- **Diagram type is selected by intent:** 
    - Data Flow → sequence diagram
    - schema/model questions → ER diagram
    - Exploratory → flowchart
    - Locational → no diagram, pointer only.
- **Retrieval:** Favor retrieving broad architectural slices (folders, entry points) rather than narrow snippets.
- Hybrid retrieval: graph traversal + BM25 + embedding search via `pgvector`.
- Token budget manager.

---

## Milestone 4: The Wiki Generator & Visualizer

**Goal:** Automatically generate the primary artifacts (documentation and diagrams). Replaces the finding/severity review UI.

### Deliverables
- Retains `framework-registry.ts` and the version-grounding orchestrator as an annotation source — wiki pages surface deprecated/version-mismatched API usage inline.
- **Module Summarizer:** A resumable batch process that runs the LLM over folders to generate `summary.md` files.
- **Mermaid Generator:** Specialized prompts that take a graph slice and convert it into a Mermaid sequence or flow diagram.

### Database Schema (Wiki)
Add tables for:
- `WikiPage`
- `Diagram` (with `type` column: sequence / flowchart / ER / component)
- `FolderSummary`

---

## Milestone 5: The "Chat with your Codebase" UI

**Goal:** Provide the primary and secondary user interfaces for exploring the generated intelligence.

### Deliverables
**The Wiki is the primary artifact** (skimmable, linkable, exportable); **chat is a secondary refinement layer**. Answers to novel questions not yet covered in the Wiki should be promotable back into a WikiPage, not left only in the chat transcript.

- **Wiki UI:** A nested, Notion-like sidebar representing the repository structure, displaying the auto-generated documentation and diagrams.
- **Onboarding Chatbot:** A persistent chat window that leverages the Context Engine to answer specific questions, citing the graph nodes and auto-generated diagrams as evidence.

---

## Tech Stack Additions

| Component | Choice |
|-----------|--------|
| Database | PostgreSQL (Neon) with pgvector |
| ORM | Prisma |
| Parsing | Tree-sitter (WASM) |
| Embeddings | BAAI/bge-small-en-v1.5 (via Transformers.js) |
| GitHub API | @octokit/rest |

---

## Estimated Effort

| Milestone | Weeks | Risk |
|-----------|-------|------|
| 1. Repository Indexer | 2 | Low |
| 2. Code Intelligence | 3-4 | Medium (Behavioral edges are complex) |
| 3. Context Engine | 3-4 | High |
| 4. Wiki Generator | 2-3 | Medium |
| 5. Wiki & Chat UI | 2 | Low |
| **Total** | **12-15 weeks** | |
