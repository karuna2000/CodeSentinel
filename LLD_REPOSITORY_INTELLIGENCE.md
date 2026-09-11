# Low-Level Design: CodeSentinel Repository Intelligence Platform

**Status:** Proposed implementation blueprint  
**Version:** 1.0  
**Date:** 2026-09-03  
**Companion:** [HLD_REPOSITORY_INTELLIGENCE.md](HLD_REPOSITORY_INTELLIGENCE.md)

## 1. Scope and Baseline Decisions

This document converts the HLD into concrete application contracts. It covers the first production implementation for a single repository at a time, with TypeScript/JavaScript as graph-complete languages.

### Baseline choices

| Concern | Decision | Reason |
| --- | --- | --- |
| Control plane | Next.js App Router route handlers | Matches the current application and supports streamed UI responses |
| ORM | Prisma for normal access; parameterized SQL for full-text/vector operations | Type safety plus PostgreSQL-specific search support |
| Database | PostgreSQL with `pgvector` and full-text search | One authoritative transactional knowledge store |
| Queue | Durable PostgreSQL-backed queue adapter | Jobs survive Redis loss and align with transactional outbox semantics |
| Cache/rate limit | Redis | Ephemeral low-latency state only |
| Source/artifacts | S3-compatible encrypted object storage | Immutable large blobs and lifecycle policies |
| Parsing | Tree-sitter running in index workers | Deterministic, language-specific syntax extraction |
| Embeddings | Provider-neutral `EmbeddingProvider` interface | Allows quality/cost/privacy changes without schema changes |
| Model access | Provider-neutral `LlmGateway` interface | Centralized redaction, usage accounting, and failover |
| Tracing | OpenTelemetry-compatible instrumentation | Vendor-independent traces, metrics, and logs |

The queue adapter may be `pg-boss` or an equivalent PostgreSQL-backed service. It must implement the contracts below, support retries and dead-letter handling, and be driven through the transactional outbox.

## 2. Application Module Layout

Add production modules without moving intentional feature stubs. The following is the target logical layout; migration may be incremental.

```text
src/
  app/api/
    github/webhooks/route.ts
    repositories/[repoId]/
      sync/route.ts
      status/route.ts
      chat/route.ts
      wiki/route.ts
      artifacts/[artifactId]/publish/route.ts
  features/repository-intelligence/
    domain/
      entities.ts
      repository-revision.ts
      policies.ts
    services/
      repository-access-service.ts
      index-orchestrator.ts
      revision-service.ts
      context-planner.ts
      citation-validator.ts
    repositories/
      repository-repository.ts
      revision-repository.ts
      graph-repository.ts
      search-repository.ts
    jobs/
      contracts.ts
      outbox-dispatcher.ts
      sync-worker.ts
      index-worker.ts
      generation-worker.ts
      evaluation-worker.ts
  features/code-intelligence/
    extractors/
    resolvers/
    adapters/
    services/
  features/agent-runtime/
    orchestrator.ts
    workflows/
    tools/
    verifier.ts
    run-store.ts
  features/evaluation/
    suites/
    runner.ts
    scorers/
  lib/
    queue/
    storage/
    telemetry/
    llm/
```

Existing code in `src/features/github`, `src/features/code-intelligence`, `src/features/context-engine`, and `src/features/llm-reasoning` should be adapted behind these contracts rather than duplicated.

## 3. Database Design

### 3.1 Naming and tenancy rules

- Use `snake_case` physical columns and Prisma `@@map`/`@map` mappings.
- Use UUID primary keys for application-owned records.
- Every tenant-owned table includes `tenant_id` and an index beginning with it.
- Every repository-derived record includes `repository_id` and `revision_id` unless it is itself the repository or revision.
- Use UTC `timestamptz` columns.
- Use `created_at`, `updated_at`, and `deleted_at` where lifecycle/audit needs require them.
- Do not store raw source content in PostgreSQL unless a narrow, reviewed use case requires it; store object references and hashes instead.

### 3.2 Core Prisma models

The following models replace the idea of a repository having one mutable file/graph state. Field names are illustrative Prisma names; migration names remain `snake_case`.

```prisma
model Tenant {
  id            String   @id @default(uuid())
  slug          String   @unique
  name          String
  createdAt     DateTime @default(now()) @map("created_at")

  memberships   TenantMembership[]
  repositories  Repository[]
  installations GithubInstallation[]

  @@map("tenants")
}

model TenantMembership {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  role      TenantRole
  createdAt DateTime @default(now()) @map("created_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId])
  @@index([userId])
  @@map("tenant_memberships")
}

model Repository {
  id                  String   @id @default(uuid())
  tenantId            String   @map("tenant_id")
  githubInstallationId String  @map("github_installation_id")
  githubRepoId        BigInt   @map("github_repo_id")
  owner               String
  name                String
  defaultBranch       String   @map("default_branch")
  indexingPolicy      Json     @default("{}") @map("indexing_policy")
  latestReadyRevisionId String? @map("latest_ready_revision_id")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  revisions           RepositoryRevision[]

  @@unique([tenantId, githubRepoId])
  @@index([tenantId, githubInstallationId])
  @@map("repositories")
}

model RepositoryRevision {
  id              String         @id @default(uuid())
  tenantId        String         @map("tenant_id")
  repositoryId    String         @map("repository_id")
  commitSha       String         @map("commit_sha")
  parentCommitSha String?        @map("parent_commit_sha")
  branch          String
  pipelineVersion String         @map("pipeline_version")
  status          RevisionStatus @default(QUEUED)
  sourceEventId   String?        @map("source_event_id")
  indexedAt       DateTime?      @map("indexed_at")
  readyAt         DateTime?      @map("ready_at")
  failureSummary  String?        @map("failure_summary")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  repository      Repository     @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  files           RepositoryFile[]
  entities        CodeEntity[]
  relationships   CodeRelationship[]
  searchDocuments SearchDocument[]
  jobs            IndexJob[]
  agentRuns       AgentRun[]
  wikiPages       WikiPage[]

  @@unique([repositoryId, commitSha, pipelineVersion])
  @@index([tenantId, repositoryId, status])
  @@index([repositoryId, createdAt])
  @@map("repository_revisions")
}

model RepositoryFile {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  path            String
  blobSha         String   @map("blob_sha")
  contentHash     String   @map("content_hash")
  objectKey       String?  @map("object_key")
  byteSize        BigInt   @map("byte_size")
  language        String?
  category        FileCategory
  isGenerated     Boolean  @default(false) @map("is_generated")
  parseStatus     ParseStatus @default(PENDING) @map("parse_status")
  parseDiagnostic Json?    @map("parse_diagnostic")
  createdAt       DateTime @default(now()) @map("created_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  entities        CodeEntity[]

  @@unique([revisionId, path])
  @@index([tenantId, repositoryId, revisionId, category])
  @@index([revisionId, blobSha])
  @@map("repository_files")
}
```

### 3.3 Graph and search models

```prisma
model CodeEntity {
  id              String         @id @default(uuid())
  tenantId        String         @map("tenant_id")
  repositoryId    String         @map("repository_id")
  revisionId      String         @map("revision_id")
  fileId          String?        @map("file_id")
  kind            CodeEntityKind
  name            String
  qualifiedName   String?        @map("qualified_name")
  signature       String?
  startLine       Int?           @map("start_line")
  endLine         Int?           @map("end_line")
  isExported      Boolean        @default(false) @map("is_exported")
  metadata        Json           @default("{}")
  extractorVersion String        @map("extractor_version")
  createdAt       DateTime       @default(now()) @map("created_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  file            RepositoryFile? @relation(fields: [fileId], references: [id], onDelete: Cascade)
  sourceEdges     CodeRelationship[] @relation("relationship_source")
  targetEdges     CodeRelationship[] @relation("relationship_target")
  documents       SearchDocument[]

  @@index([tenantId, repositoryId, revisionId, kind])
  @@index([revisionId, fileId])
  @@index([revisionId, name])
  @@index([revisionId, qualifiedName])
  @@map("code_entities")
}

model CodeRelationship {
  id              String              @id @default(uuid())
  tenantId        String              @map("tenant_id")
  repositoryId    String              @map("repository_id")
  revisionId      String              @map("revision_id")
  sourceEntityId  String              @map("source_entity_id")
  targetEntityId  String?             @map("target_entity_id")
  kind            RelationshipKind
  resolution      ResolutionStatus
  confidence      Float
  evidence        Json
  extractorVersion String              @map("extractor_version")
  createdAt       DateTime            @default(now()) @map("created_at")

  revision        RepositoryRevision  @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  sourceEntity    CodeEntity          @relation("relationship_source", fields: [sourceEntityId], references: [id], onDelete: Cascade)
  targetEntity    CodeEntity?         @relation("relationship_target", fields: [targetEntityId], references: [id], onDelete: SetNull)

  @@index([tenantId, repositoryId, revisionId, kind])
  @@index([revisionId, sourceEntityId, kind])
  @@index([revisionId, targetEntityId, kind])
  @@map("code_relationships")
}

model SearchDocument {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  fileId          String?  @map("file_id")
  entityId        String?  @map("entity_id")
  kind            SearchDocumentKind
  title           String
  text            String
  textHash        String   @map("text_hash")
  metadata        Json     @default("{}")
  embedding       Unsupported("vector(384)")?
  embeddingModel  String?  @map("embedding_model")
  createdAt       DateTime @default(now()) @map("created_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  entity          CodeEntity? @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@index([tenantId, repositoryId, revisionId, kind])
  @@index([revisionId, entityId])
  @@map("search_documents")
}
```

Create raw migrations for:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX search_documents_embedding_hnsw
  ON search_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX search_documents_text_fts
  ON search_documents USING gin (to_tsvector('english', title || ' ' || text));
CREATE INDEX repository_files_path_trgm
  ON repository_files USING gin (path gin_trgm_ops);
```

Use a `text_hash` plus embedding model version to reuse embeddings safely across revisions when the document text is identical.

### 3.4 Operational, agent, and artifact models

```prisma
model IndexJob {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  type            JobType
  status          JobStatus @default(QUEUED)
  idempotencyKey  String   @map("idempotency_key")
  payload         Json
  attempt         Int      @default(0)
  maxAttempts     Int      @default(5) @map("max_attempts")
  error           Json?
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime @default(now()) @map("created_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@unique([idempotencyKey])
  @@index([tenantId, repositoryId, status, createdAt])
  @@map("index_jobs")
}

model OutboxEvent {
  id          String   @id @default(uuid())
  aggregateId String   @map("aggregate_id")
  type        String
  payload     Json
  occurredAt  DateTime @default(now()) @map("occurred_at")
  publishedAt DateTime? @map("published_at")
  attempts    Int      @default(0)

  @@index([publishedAt, occurredAt])
  @@map("outbox_events")
}

model AgentRun {
  id              String         @id @default(uuid())
  tenantId        String         @map("tenant_id")
  repositoryId    String         @map("repository_id")
  revisionId      String         @map("revision_id")
  requestedByUserId String?      @map("requested_by_user_id")
  workflow        AgentWorkflow
  status          AgentRunStatus @default(CREATED)
  goal            String
  policyVersion   String         @map("policy_version")
  budget          Json
  consumption     Json           @default("{}")
  plan            Json?
  evidencePacket  Json?          @map("evidence_packet")
  result          Json?
  traceId         String         @map("trace_id")
  startedAt       DateTime?      @map("started_at")
  completedAt     DateTime?      @map("completed_at")
  createdAt       DateTime       @default(now()) @map("created_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  toolCalls       AgentToolCall[]

  @@index([tenantId, repositoryId, revisionId, createdAt])
  @@index([status, createdAt])
  @@map("agent_runs")
}

model AgentToolCall {
  id          String   @id @default(uuid())
  agentRunId  String   @map("agent_run_id")
  sequence    Int
  toolName    String   @map("tool_name")
  inputHash   String   @map("input_hash")
  outputRef   Json     @map("output_ref")
  status      ToolCallStatus
  latencyMs   Int?     @map("latency_ms")
  error       Json?
  createdAt   DateTime @default(now()) @map("created_at")

  agentRun    AgentRun @relation(fields: [agentRunId], references: [id], onDelete: Cascade)

  @@unique([agentRunId, sequence])
  @@map("agent_tool_calls")
}

model WikiPage {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  scopeType       WikiScopeType @map("scope_type")
  scopeRef        String   @map("scope_ref")
  title           String
  content         String
  citations       Json
  status          ArtifactStatus @default(GENERATED)
  generatedByRunId String? @map("generated_by_run_id")
  supersedesId    String?  @map("supersedes_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  revision        RepositoryRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)

  @@unique([repositoryId, revisionId, scopeType, scopeRef])
  @@index([tenantId, repositoryId, status])
  @@map("wiki_pages")
}

model FrameworkProfile {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  framework       String
  detectedVersion String?  @map("detected_version")
  confidence      Float
  evidence        Json
  registryVersion String   @map("registry_version")
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([revisionId, framework])
  @@index([tenantId, repositoryId, revisionId])
  @@map("framework_profiles")
}

model CompatibilityAnnotation {
  id              String   @id @default(uuid())
  tenantId        String   @map("tenant_id")
  repositoryId    String   @map("repository_id")
  revisionId      String   @map("revision_id")
  entityId        String?  @map("entity_id")
  framework       String
  apiPattern      String   @map("api_pattern")
  severity        AnnotationSeverity
  message         String
  evidence        Json
  registryVersion String   @map("registry_version")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([tenantId, repositoryId, revisionId, framework])
  @@index([revisionId, entityId])
  @@map("compatibility_annotations")
}

model CodeOwnershipRule {
  id           String   @id @default(uuid())
  tenantId     String   @map("tenant_id")
  repositoryId String   @map("repository_id")
  revisionId   String   @map("revision_id")
  pattern      String
  owners       Json
  sourcePath   String   @map("source_path")
  lineNumber   Int      @map("line_number")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([tenantId, repositoryId, revisionId])
  @@map("code_ownership_rules")
}
```

Key enums:

```text
RevisionStatus: QUEUED | SYNCING | EXTRACTING | READY | PARTIAL | FAILED | STALE
FileCategory: SOURCE | DOCUMENTATION | CONFIGURATION | TEST | GENERATED | BINARY | EXCLUDED
ParseStatus: PENDING | PARSED | SKIPPED | FAILED
CodeEntityKind: REPOSITORY | FOLDER | FILE | FUNCTION | CLASS | INTERFACE | TYPE | ROUTE | COMPONENT | MODEL | VARIABLE
RelationshipKind: CONTAINS | IMPORTS | EXPORTS | CALLS | INHERITS | DEFINES_ROUTE | FETCHES_ROUTE | READS_STORE | WRITES_STORE | QUERIES_MODEL
ResolutionStatus: EXACT | HEURISTIC | UNRESOLVED
JobType: SYNC_REVISION | FETCH_FILE | PARSE_FILE | RESOLVE_RELATIONSHIPS | EMBED_DOCUMENT | GROUND_VERSION | GENERATE_WIKI | GENERATE_DIAGRAM | EVALUATE
AgentWorkflow: REPOSITORY_QA | DATA_FLOW | CHANGE_IMPACT | WIKI_DRAFT | INDEX_REMEDIATION
AgentRunStatus: CREATED | PLANNING | EXECUTING | VERIFYING | COMPLETED | NEEDS_INPUT | REJECTED | FAILED | CANCELLED
ArtifactStatus: GENERATED | HUMAN_REVIEWED | STALE | ARCHIVED
AnnotationSeverity: INFO | WARNING | ERROR
```

## 4. Authorization and Repository Access

### 4.1 Server-side access contract

No feature calls Prisma with only a `repositoryId`. All repository operations first resolve scoped access:

```ts
export interface RepositoryAccess {
  tenantId: string;
  userId: string;
  repositoryId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface RepositoryAccessService {
  requireAccess(input: {
    sessionUserId: string;
    repositoryId: string;
    minimumRole: 'VIEWER' | 'MEMBER' | 'ADMIN';
  }): Promise<RepositoryAccess>;
}
```

`requireAccess` verifies tenant membership, repository tenant ownership, GitHub installation binding, and requested role. Repository-scoped repository classes accept `RepositoryAccess`, never raw IDs from request parameters.

### 4.2 GitHub webhook handling

`POST /api/github/webhooks`:

1. Read raw request body once.
2. Validate `x-hub-signature-256` with the webhook secret using constant-time comparison.
3. Read `x-github-delivery`, event type, installation ID, and repository ID.
4. Store the delivery ID in `github_webhook_events` with a unique constraint; return `202` for duplicates.
5. Within one database transaction, create/update the repository event intent and write an `OutboxEvent`.
6. Return `202 Accepted` without fetching repository content.

Reject missing/invalid signatures with `401`; unsupported events return `204`; malformed but authenticated payloads return `400` and emit a security event.

## 5. HTTP API Contracts

All endpoints require an authenticated session except webhook ingress. Each response includes `x-request-id`; repository responses include `x-repository-revision` when a revision is selected.

### 5.1 Repository endpoints

| Method and path | Role | Request | Response |
| --- | --- | --- | --- |
| `POST /api/repositories/:repoId/sync` | Member | `{ branch?: string, force?: boolean }` | `202 { revisionId, status }` |
| `GET /api/repositories/:repoId/status` | Viewer | optional `revision` | repository, latest revision, job summary, freshness |
| `GET /api/repositories/:repoId/files` | Viewer | `revision`, `pathPrefix`, cursor | paginated file manifest |
| `GET /api/repositories/:repoId/entities/:entityId` | Viewer | `revision` | entity, relationships, evidence |
| `POST /api/repositories/:repoId/chat` | Viewer | chat request below | streamed answer plus citations |
| `GET /api/repositories/:repoId/wiki` | Viewer | `revision`, scope/cursor | wiki pages and stale state |
| `POST /api/artifacts/:artifactId/publish` | Member | `{ expectedVersion }` | published artifact |

### 5.2 Chat request and streamed response

```ts
const RepositoryChatRequestSchema = z.object({
  revisionId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(8_000),
  conversationId: z.string().uuid().optional(),
  workflow: z.enum(['auto', 'repository_qa', 'data_flow', 'change_impact']).default('auto'),
});

const CitationSchema = z.object({
  entityId: z.string().uuid().optional(),
  fileId: z.string().uuid(),
  filePath: z.string(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  evidenceKind: z.enum(['SOURCE', 'GRAPH', 'WIKI']),
});

const RepositoryAnswerEnvelopeSchema = z.object({
  revision: z.object({
    id: z.string().uuid(),
    commitSha: z.string(),
    status: z.enum(['READY', 'PARTIAL', 'STALE']),
    isStale: z.boolean(),
  }),
  confidence: z.enum(['SUPPORTED', 'PARTIAL', 'INSUFFICIENT_EVIDENCE']),
  citations: z.array(CitationSchema),
  agentRunId: z.string().uuid(),
});
```

Stream text through the existing AI SDK transport, but emit the envelope as structured metadata before/after the text. Persist the completed envelope and citation IDs in `AgentRun.result`; do not rely on an HTTP header as the canonical citation transport.

### 5.3 Error shape

```json
{
  "error": {
    "code": "REVISION_NOT_READY",
    "message": "The selected repository revision is still indexing.",
    "requestId": "...",
    "retryable": true
  }
}
```

Use stable codes: `UNAUTHORIZED`, `FORBIDDEN`, `REPOSITORY_NOT_FOUND`, `REVISION_NOT_FOUND`, `REVISION_NOT_READY`, `RATE_LIMITED`, `VALIDATION_ERROR`, `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `CONFLICT`, and `INTERNAL_ERROR`.

## 6. Job and Outbox Contracts

### 6.1 Common job payload

```ts
export interface JobContext {
  jobId: string;
  tenantId: string;
  repositoryId: string;
  revisionId: string;
  pipelineVersion: string;
  traceId: string;
  idempotencyKey: string;
}

export interface SyncRevisionJob extends JobContext {
  type: 'SYNC_REVISION';
  installationId: string;
  owner: string;
  repositoryName: string;
  branch: string;
  commitSha: string;
}

export interface ParseFileJob extends JobContext {
  type: 'PARSE_FILE';
  fileId: string;
  path: string;
  blobSha: string;
}
```

All payloads are Zod-validated both before enqueueing and by the worker before execution. Queue messages include no source content and no GitHub private keys/tokens.

### 6.2 Outbox dispatcher

```ts
interface OutboxDispatcher {
  publishPending(limit: number): Promise<number>;
}
```

The dispatcher uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim unpublished rows, sends each message with its idempotency key, then marks it published. A periodic job retries unacknowledged events. Consumers treat duplicate deliveries as normal.

### 6.3 Retry policy

| Job type | Max attempts | Backoff | Terminal behavior |
| --- | --- | --- | --- |
| GitHub sync/fetch | 6 | exponential, jitter, honor rate-limit reset | revision `FAILED` only after all retries |
| Parse file | 2 | short exponential | file `FAILED`; revision may become `PARTIAL` |
| Relationship resolve | 3 | exponential | record unresolved edges and diagnostic |
| Embedding | 5 | provider-aware exponential | lexical search remains available |
| Version grounding | 3 | short exponential | omit annotations; never block structural index readiness |
| Generation | 4 | provider-aware exponential | artifact draft `FAILED`; revision remains ready |
| Evaluation | 2 | short exponential | report infrastructure failure separately |

## 7. Indexing Worker Design

### 7.1 Sync worker algorithm

```text
handleSyncRevision(job):
  assert revision belongs to tenant/repository and is QUEUED or retryable
  acquire repository+branch lock
  set revision SYNCING
  fetch commit and recursive tree using installation-scoped GitHub client
  load preceding READY revision for same branch
  classify each tree blob using policy, extension, size, and generated-file rules
  upsert RepositoryFile records for eligible and excluded paths
  compare blob SHA with preceding revision
  enqueue PARSE_FILE only for changed supported source files
  enqueue SEARCH_DOCUMENT for changed README, documentation, ADR, and configuration files as policy permits
  parse .github/CODEOWNERS into revision-scoped ownership rules when present
  enqueue GROUND_VERSION after manifests, lockfiles, and source extraction are available
  set revision EXTRACTING
  enqueue revision-finalization check
  release lock
```

File policy defaults:

```text
max source file size: 1 MiB
max documentation file size: 2 MiB
exclude: .git, node_modules, vendor, dist, build, .next, coverage, binaries,
         minified bundles, lockfiles, media, archives, configured sensitive paths
generated detection: path conventions + generated header markers + configured glob rules
```

Store a `SKIPPED` record/reason for excluded content so index counts are explainable.

### 7.2 Parse worker algorithm

```text
handleParseFile(job):
  load file and revision under tenant scope
  return if file parse status is PARSED for same blob SHA/extractor version
  read object content through policy-enforcing storage service
  select language extractor by normalized extension
  parse source with Tree-sitter
  persist parse diagnostic if parser reports recoverable errors
  extract file entity, symbols, exports, imports, and raw references
  create search documents for file/module and exported symbols
  set file parse status PARSED
  enqueue relationship-resolution job for the revision
```

Use bulk inserts per file transaction. If extraction fails, retain file metadata and set `parse_status = FAILED` with a bounded diagnostic; never discard the original file manifest.

### 7.3 Documentation and version-grounding worker

Documentation files are not treated as generated wiki content. `README`, `/docs`, configured ADR paths, and approved Markdown/text files create `SearchDocument` records with `kind = REPOSITORY_DOCUMENTATION`, plus file/path citations. The UI distinguishes them from generated pages.

`GROUND_VERSION` runs after configuration and source extraction:

```text
handleGroundVersion(job):
  read package manifests, lockfiles, framework configuration, and detected API patterns
  resolve framework versions from explicit manifest/lockfile evidence first
  persist FrameworkProfile with source citations and confidence
  match detected API patterns against a versioned compatibility registry
  persist CompatibilityAnnotation only when framework/version evidence is sufficient
  mark annotation as unavailable, rather than guessing, when the installed version cannot be established
```

The compatibility registry is versioned data with its own release/test process. Each annotation stores the registry version used, so a registry refresh can be re-run independently of Git source indexing.

### 7.4 Resolver algorithm

The resolver runs after parse jobs are complete or in bounded batches. It resolves references in this order:

1. Relative import path using extension/index-file rules.
2. TypeScript `baseUrl` and `paths` aliases from the indexed revision configuration.
3. Package export map for installed workspace packages only when source is indexed and policy allows it.
4. Named export/default export lookup in the target module.
5. Framework-specific conventions, such as Next.js route file patterns.

Emit `EXACT` only when the target entity/file is deterministically located. Emit `HEURISTIC` only with a confidence score and evidence. Preserve `UNRESOLVED` records for diagnostic/search use, with `target_entity_id = null`.

### 7.5 Revision finalization

```text
finalizeRevision(revision):
  count required jobs and failures
  if required jobs still pending: reschedule finalization
  if sync or required structural extraction failed: set FAILED
  else if optional parse/embedding/enrichment failures exist: set PARTIAL
  else: set READY
  set indexed_at/ready_at
  atomically update Repository.latestReadyRevisionId only for READY or PARTIAL
  emit revision-ready domain event
```

`PARTIAL` revisions may be queried, but the UI and answer contract list unavailable capabilities, such as “semantic retrieval unavailable for 14 files.”

## 8. Context Planner and Retrieval Design

### 8.1 Input/output contract

```ts
export interface ContextPlannerInput {
  access: RepositoryAccess;
  revisionId: string;
  question: string;
  intent: 'LOCATIONAL' | 'EXPLORATORY' | 'DATA_FLOW' | 'SCHEMA' | 'CHANGE_IMPACT';
  budget: { maxTokens: number; maxSourceBytes: number; maxDocuments: number };
}

export interface EvidencePacket {
  revision: { id: string; commitSha: string; status: string; isStale: boolean };
  entities: EvidenceEntity[];
  relationships: EvidenceRelationship[];
  documents: EvidenceDocument[];
  citations: Citation[];
  omissions: Array<{ reason: string; count?: number }>;
  tokenEstimate: number;
}
```

### 8.2 Candidate retrieval

Run these sources independently, with hard result limits:

1. **Exact resolver:** normalized file path, qualified symbol, route string, and identifier matches.
2. **Lexical search:** PostgreSQL full-text query over search documents, weighted title/path/signature higher than body text.
3. **Path similarity:** trigram match for probable filenames/paths.
4. **Semantic search:** cosine vector similarity for the query embedding when embeddings are available.
5. **Graph expansion:** typed, depth-limited neighbors of the highest-confidence seed entities.
6. **Repository documentation:** boost human-authored README/ADR/docs evidence for exploratory questions, while retaining its own citation type.
7. **Version annotations:** retrieve only annotations whose `FrameworkProfile` has revision-matched version evidence.

All SQL queries constrain `tenant_id`, `repository_id`, and `revision_id` before applying rank/order clauses.

### 8.3 Ranking formula

Normalize each candidate source score to `[0, 1]`, then use:

```text
score = 0.35 * exact_match
      + 0.25 * lexical_rank
      + 0.20 * semantic_rank
      + 0.15 * graph_proximity
      + 0.05 * structural_priority
```

`structural_priority` boosts route handlers, exported entry points, models, module index files, human-reviewed wiki pages, and repository documentation for exploratory queries. For a data-flow workflow, reweight graph proximity to `0.30` and semantic rank to `0.05`. Store ranking features in the trace for evaluation.

### 8.4 Graph traversal limits

| Intent | Allowed relationship types | Max depth | Max neighbors/entity |
| --- | --- | --- | --- |
| Locational | `CONTAINS`, `EXPORTS`, `IMPORTS` | 1 | 20 |
| Exploratory | `CONTAINS`, `IMPORTS`, `EXPORTS`, `DEFINES_ROUTE` | 2 | 25 |
| Data flow | `DEFINES_ROUTE`, `CALLS`, `FETCHES_ROUTE`, `QUERIES_MODEL`, `READS_STORE`, `WRITES_STORE` | 4 | 12 |
| Schema | `CONTAINS`, `QUERIES_MODEL` | 2 | 20 |
| Change impact | reverse `IMPORTS`, `CALLS`, `EXPORTS` | 3 | 20 |

Only `EXACT` and `HEURISTIC` edges with confidence `>= 0.80` enter default agent evidence. Lower-confidence edges can be returned as explicitly tentative supplemental context.

### 8.5 Context packing

1. Reserve 15% of the token budget for instructions and output safety margin.
2. Add direct entity metadata and citations first.
3. Add source spans in ranked order, preferring signature/declaration plus a narrow body span.
4. Add graph relationships that connect selected entities.
5. Add concise wiki summaries only if they cite the same revision or are labeled stale.
6. Add version annotations only after their version and API evidence is present in the packet.
7. Stop before budget overflow and record excluded candidates in `omissions`.

Source spans are trimmed server-side; the LLM never decides how much unrestricted code to read.

## 9. Agent Runtime Design

### 9.1 Agent state machine

```text
CREATED
  -> PLANNING
  -> EXECUTING
  -> VERIFYING
  -> COMPLETED

EXECUTING -> NEEDS_INPUT | FAILED | CANCELLED
VERIFYING -> EXECUTING | REJECTED | COMPLETED
```

Persist every state transition in a transaction and emit a trace event. A request retry finds the existing active run by `(user, revision, normalized goal, workflow)` within a short idempotency window.

### 9.2 Run budget

```ts
const DEFAULT_AGENT_BUDGET = {
  maxToolCalls: 12,
  maxWallClockMs: 45_000,
  maxGraphDepth: 4,
  maxSourceBytes: 80_000,
  maxContextTokens: 18_000,
  maxModelOutputTokens: 2_000,
  maxEstimatedCostUsd: 0.12,
};
```

Budgets are enforced by the orchestrator before each tool/model call. When a limit is reached, the run transitions to `COMPLETED` with `PARTIAL` or `INSUFFICIENT_EVIDENCE`, including the gathered citations and a concise limitation.

### 9.3 Typed tool interface

```ts
export interface AgentTool<TInput, TOutput> {
  readonly name: string;
  readonly schema: z.ZodType<TInput>;
  execute(context: ToolExecutionContext, input: TInput): Promise<TOutput>;
}

export interface ToolExecutionContext {
  access: RepositoryAccess;
  revisionId: string;
  agentRunId: string;
  policy: AgentPolicy;
  budget: BudgetGuard;
  trace: TraceContext;
}
```

Implemented tools:

```text
resolve_entity
search_repository
traverse_graph
read_source_span
compare_revisions
get_wiki_artifact
draft_artifact
```

Tool output is stored as IDs, score summaries, citations, and content hashes in `AgentToolCall.output_ref`. Store raw sensitive source only in the normal source object store and retrieve it again under policy when needed.

### 9.4 Planner and verifier behavior

The planner receives the user goal, available tool descriptions, revision metadata, and remaining budget. It returns a JSON plan with at most four steps. The orchestrator rejects plans that reference unavailable tools, cross-tenant targets, or budget-violating arguments.

The verifier performs deterministic checks before model synthesis and after model output:

```text
before synthesis:
  evidence is non-empty
  all cited entities/files belong to selected revision
  source content matches policy
  graph paths satisfy traversal limits

after synthesis:
  every cited ID is in EvidencePacket.citations
  every answer paragraph has at least one citation unless it is a limitation
  no source path/line reference is fabricated
  Mermaid uses only selected graph nodes/edges
  output passes content and length policies
```

If validation fails, the verifier may request one additional targeted retrieval, otherwise it returns `INSUFFICIENT_EVIDENCE` rather than retrying indefinitely.

## 10. LLM Gateway Design

```ts
export interface LlmGateway {
  streamAnswer(input: AnswerGenerationInput): Promise<StreamedAnswer>;
  generateStructured<T>(input: StructuredGenerationInput<T>): Promise<T>;
  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}
```

### Gateway processing order

1. Check tenant model policy and remaining cost quota.
2. Apply source redaction/path policy to the evidence packet.
3. Attach prompt template, model name, policy version, and trace metadata.
4. Execute with timeouts, retryable-error classification, circuit breaker, and provider fallback policy.
5. Capture usage/latency/cost metadata.
6. Return model output to verifier, never directly to the HTTP response.

The chat system prompt requires claims to be based only on the provided evidence packet and uses citation tokens like `[cite:abc123]`. The verifier resolves those tokens into final user-visible citations.

## 11. Wiki and Diagram Generation

### 11.1 Wiki draft job

`GENERATE_WIKI` input:

```ts
{
  repositoryId: string;
  revisionId: string;
  scope: { type: 'REPOSITORY' | 'FOLDER' | 'MODULE'; ref: string };
  requestedByUserId?: string;
}
```

The job creates an `AgentRun` using `WIKI_DRAFT`, collects scoped evidence, generates markdown with citation tokens, validates it, and saves a `WikiPage` with status `GENERATED`. It never overwrites a `HUMAN_REVIEWED` page. A new draft uses `supersedes_id` and the UI presents a diff for approval.

Generation is scheduled only for the repository overview, top-level folders, route/service/model modules, and explicitly requested scopes. The scheduler uses file count, dependency centrality, user requests, and changed entities to prioritize work; it never attempts to summarize every folder by default.

### 11.2 Wiki navigation and ownership

The wiki sidebar is built from the selected revision's file tree and page scopes. Each entry exposes:

```text
path/title, document type (repository-authored or generated), revision, freshness,
generation/review status, citation count, version-warning count, ownership hint
```

Ownership hints are computed by matching the current file path against ordered `CodeOwnershipRule` patterns. The UI labels the result “CODEOWNERS hint” and links to the source `.github/CODEOWNERS` line; it does not imply authorization or active responsibility.

### 11.3 Diagram draft job

1. Select a typed graph subgraph from verified relationships.
2. Convert it to an intermediate `DiagramSpec` JSON object.
3. Generate Mermaid from the `DiagramSpec`, not from arbitrary source text.
4. Parse/validate Mermaid syntax in a sandboxed renderer.
5. Reject any required edge that is unresolved or below the workflow confidence threshold; optional heuristic edges are visibly styled and labeled.
6. Save source graph citations, edge confidence, and validation diagnostics with the diagram.

```ts
interface DiagramSpec {
  type: 'sequence' | 'flowchart' | 'er' | 'component';
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ source: string; target: string; label: string; relationshipId: string }>;
}
```

## 12. Observability Implementation

### 12.1 Trace spans

Use the following stable span names:

```text
http.repository_chat
webhook.github.receive
outbox.publish
job.sync_revision
job.parse_file
job.resolve_relationships
job.embed_document
job.ground_version
agent.run
agent.plan
agent.tool.<tool_name>
context.retrieve.<source>
context.rank
context.pack
llm.generate
verifier.pre_synthesis
verifier.post_synthesis
evaluation.run
```

Common attributes:

```text
app.request_id, tenant.id, repository.id, revision.id, revision.commit_sha,
job.id, agent.run_id, pipeline.version, prompt.version, model.name,
workflow.type, error.code, retry.attempt
```

Never add raw source, raw prompt, GitHub token, session token, or user email as trace attributes.

### 12.2 Metrics

```text
repository_index_duration_seconds{stage, status}
repository_index_files_total{category, parse_status}
repository_relationships_total{kind, resolution}
framework_profiles_total{framework, confidence_band}
compatibility_annotations_total{framework, severity}
queue_messages_total{type, outcome}
queue_age_seconds{type}
context_retrieval_duration_seconds{source}
context_candidates_total{source}
agent_runs_total{workflow, status}
agent_tool_calls_total{tool, outcome}
agent_budget_exhausted_total{dimension}
llm_requests_total{provider, model, outcome}
llm_cost_usd_total{provider, model, tenant_tier}
answer_citations_total{confidence}
answer_citation_validation_failures_total{reason}
evaluation_score{suite, metric, system_version}
```

### 12.3 Logs and audit events

Use structured JSON logs. Audit events are persisted separately from operational logs:

```ts
type AuditEvent = {
  tenantId: string;
  actorType: 'USER' | 'SYSTEM' | 'GITHUB' | 'AGENT';
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  revisionId?: string;
  traceId: string;
  metadata: Record<string, string | number | boolean>;
};
```

Examples: `repository.sync.requested`, `source.span.read`, `agent.run.completed`, `wiki.draft.published`, and `policy.redaction.applied`.

## 13. Evaluation System Design

### 13.1 Fixture schema

Store baseline fixtures in version-controlled files and load them into evaluation tables only for reporting:

```yaml
id: auth-data-flow-001
repository_fixture: nextjs-auth-sample
revision: 7b2c...
workflow: DATA_FLOW
question: Trace sign-in from HTTP request to session creation.
expected:
  entities:
    - src/app/api/auth/route.ts::POST
    - src/lib/auth/session.ts::createSession
  relationship_kinds: [DEFINES_ROUTE, CALLS]
  citations:
    min_count: 2
  answer_properties:
    - distinguishes authentication from session persistence
    - names the route entry point
  confidence: SUPPORTED
  version_grounding:
    framework: next
    detected_version: "15.2.0"
    required_evidence: [package.json, package-lock.json]
```

### 13.2 Evaluation runner

```text
runEvaluation(suite, systemVersion):
  load fixture revision and expected evidence
  execute extraction/resolution assertions
  execute retrieval with fixed question
  record rank/candidate/evidence metrics
  execute agent workflow with fixed policy/model
  deterministically validate citations and revision ownership
  apply rubric checks and optional judge model
  persist EvaluationRun and findings
  return pass/fail against suite thresholds
```

### 13.3 Metrics and release gates

| Metric | Initial release gate |
| --- | --- |
| Required entity retrieval recall@10 | >= 0.90 |
| Exact citation validity | 1.00 |
| Unsupported citation rate | 0.00 |
| Correct abstention on negative cases | >= 0.95 |
| Critical extractor fixture pass rate | 1.00 |
| Version grounding evidence validity | 1.00 |
| Compatibility annotation false-positive rate | <= 0.02 |
| Median agent run cost | within configured workflow budget |
| p95 agent run latency | within workflow SLO |

Any failed citation-validity check blocks promotion. Retrieval and rubric regressions require an explicit reviewed waiver linked to an `EvaluationFinding`; they must not be silently accepted because prose sounds better.

### 13.4 Online quality loop

- Persist explicit user feedback: useful, inaccurate, stale, irrelevant citation, or unsafe.
- Sample completed runs for expert review, stratified by workflow and confidence.
- Shadow-run candidate prompts/models/tools on opted-in traffic without showing their output.
- Compare candidate and baseline on cost, latency, citation validity, retrieval evidence, and reviewer labels.
- Convert accepted corrections and rejected artifacts into sanitized evaluation cases.
- Run compatibility-registry fixture tests for each registry release, including absent/ambiguous version cases that must produce no annotation.

## 14. Security Controls by Layer

| Layer | Controls |
| --- | --- |
| Browser | HttpOnly secure sessions, CSP, CSRF defense where applicable, request schema validation |
| API | tenant access service, rate limits, request IDs, output encoding, no direct object-store keys exposed |
| Webhook | HMAC signature validation, delivery deduplication, restricted event logging |
| Queue/worker | validated payloads, tenant/revision scope assertions, least-privileged credentials, idempotency |
| Storage | encryption in transit/at rest, source retention policy, signed short-lived internal access only |
| Database | tenant-scoped repository layer, parameterized SQL, migration review, backup/PITR |
| Agent tools | allowlist, schema validation, budget guard, no arbitrary execution/network/SQL |
| LLM gateway | minimal/redacted evidence, provider policy, usage audit, no tokens or source in logs |

Interactive API rate limits use Redis-backed sliding-window or token-bucket keys such as `rate:chat:<tenantId>:<userId>` and `rate:sync:<tenantId>:<repositoryId>`. Limits are configured by tenant tier and endpoint, instrumented, and fail closed for unauthenticated abuse. In-memory counters are permitted only in local development.

## 15. Testing Strategy

| Test type | Focus | Example |
| --- | --- | --- |
| Unit | pure extraction, resolver rules, ranking, budget, citation validator | TypeScript path alias resolves to correct module |
| Integration | database, queue, GitHub client mocks, object storage adapter | duplicate webhook creates one revision job |
| Contract | API/Zod schemas and tool inputs/outputs | chat stream envelope stays backward compatible |
| Fixture | parser/resolver correctness on representative repositories | route/model/store extraction |
| Evaluation | retrieval, grounding, abstention, cost/latency | negative query returns insufficient evidence |
| Security | tenant isolation, policy enforcement, webhook verification | user from tenant A cannot read tenant B revision |
| Load | sync concurrency, retrieval latency, streaming capacity | 100 simultaneous query plans on ready revision |
| Failure injection | provider, queue, DB, GitHub API degradation | old ready revision remains queryable after sync failure |

CI runs unit, integration, contract, and deterministic fixture tests on every change. Model-dependent evaluation runs on prompt/model/agent/retrieval changes and nightly; protected release suites run before deployment.

## 16. Migration from Current Prototype

1. Introduce new revision models alongside current `Repository`, `File`, `GraphNode`, and `GraphEdge` tables.
2. Backfill a `RepositoryRevision` for each existing indexed repository using its recorded sync timestamp and current branch head if available; label uncertain provenance clearly.
3. Route new indexing through `IndexJob` and the outbox, leaving the old graph readable during the migration.
4. Replace destructive `deleteMany` graph rebuilds with revision-scoped writes.
5. Map current graph nodes/edges to `CodeEntity`/`CodeRelationship`; label naive name-linked edges `UNRESOLVED` or remove them from agent retrieval until re-resolved.
6. Move inline intent detection and raw citation-header logic from the chat route into `ContextPlanner` and `CitationValidator`.
7. Add the agent runtime behind a feature flag after revision-scoped retrieval is stable.
8. Add documentation ingestion, `CODEOWNERS` parsing, and revision-scoped version grounding after structural extraction is stable.
9. Add wiki generation and diagram jobs after citation validity is protected by evaluation gates.

## 17. Implementation Order and Acceptance Criteria

### Milestone A: Revision-safe indexing

Acceptance criteria:

- A sync creates exactly one revision per repository/commit/pipeline version.
- Duplicate webhooks and job retries do not duplicate files/entities/edges.
- A failed new revision never removes the prior ready revision.
- Every file/entity/relationship query is tenant and revision scoped.

### Milestone B: Trusted retrieval

Acceptance criteria:

- Exact symbol/path queries return revision-scoped citations.
- Lexical retrieval works when embeddings are unavailable.
- Graph traversal enforces type/depth/confidence limits.
- Context packing remains under configured budget and reports omissions.

### Milestone C: Bounded agent Q&A

Acceptance criteria:

- Every agent run has a persisted plan, tool-call sequence, budget, evidence packet, and terminal state.
- Tool calls are deny-by-default and cannot cross tenant/revision boundaries.
- All response citations are verified against the evidence packet.
- Budget exhaustion produces a useful partial/limited result, not an unbounded retry.

### Milestone D: Generated knowledge and quality operations

Acceptance criteria:

- Wiki/diagram output is revision-scoped, cited, validated, and draft-only by default.
- Operational dashboards show queue, indexing, retrieval, agent, model, and grounding health.
- Protected evaluation suite gates prompt/model/retrieval/agent changes.
- Runbooks exist and have been tested for failed indexing, model outage, data restoration, and tenant deletion.

### Milestone E: Versioned knowledge experience

Acceptance criteria:

- Existing repository documentation and generated wiki pages are visibly distinct and both are citable.
- `CODEOWNERS` hints are revision-scoped, source-linked, and never used for authorization.
- Compatibility annotations include manifest/lockfile and API-pattern evidence, or are omitted.
- The wiki sidebar exposes revision, freshness, review status, ownership hints, and version warnings.

## 18. Deferred Design Decisions

- Exact object-storage provider and regional/data-residency topology.
- Specific observability vendor and retention configuration.
- Exact embedding model and dimension; schema/migrations must make re-embedding possible.
- Whether PostgreSQL row-level security is enabled after tenant query patterns stabilize.
- Support for Python and other language adapters after fixture/evaluation coverage meets the same standards.
- Organization-wide and cross-repository graph queries after single-repository correctness is established.

## 19. LLD Decision

Implement the platform as a revision-scoped repository knowledge system with durable PostgreSQL-backed jobs, typed code intelligence, hybrid retrieval, bounded agent tools, server-side citation validation, and mandatory operational/evaluation contracts. The first code changes should establish revisions, jobs, and tenant-scoped access before expanding parsing or agent behavior.
