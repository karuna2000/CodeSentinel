-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "graph_node_type" AS ENUM ('REPO', 'FOLDER', 'FILE', 'FUNCTION', 'CLASS', 'INTERFACE', 'TYPE', 'ROUTE', 'COMPONENT', 'VARIABLE');

-- CreateEnum
CREATE TYPE "graph_edge_type" AS ENUM ('CONTAINS', 'IMPORTS', 'CALLS', 'INHERITS', 'READS_STORE', 'FETCHES_ROUTE');

-- CreateEnum
CREATE TYPE "diagram_type" AS ENUM ('FLOWCHART', 'SEQUENCE', 'ER', 'COMPONENT');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "github_installations" (
    "id" TEXT NOT NULL,
    "installation_id" BIGINT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "github_repo_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "language" TEXT,
    "description" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "is_indexed" BOOLEAN NOT NULL DEFAULT false,
    "file_count" INTEGER NOT NULL DEFAULT 0,
    "readme_content" TEXT,
    "user_id" TEXT NOT NULL,
    "commit_sha" TEXT,
    "last_synced" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content_hash" TEXT,
    "size" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_nodes" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "file_id" TEXT,
    "type" "graph_node_type" NOT NULL,
    "name" TEXT NOT NULL,
    "code_snippet" TEXT,
    "signature" TEXT,
    "documentation" TEXT,
    "start_line" INTEGER,
    "end_line" INTEGER,
    "start_byte" INTEGER,
    "end_byte" INTEGER,
    "content_hash" TEXT,
    "index_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(384),

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "source_node_id" TEXT NOT NULL,
    "target_node_id" TEXT NOT NULL,
    "type" "graph_edge_type" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_pages" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagrams" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "path" TEXT,
    "type" "diagram_type" NOT NULL,
    "mermaid_src" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'wiki',
    "status" "job_status" NOT NULL DEFAULT 'PENDING',
    "step" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "error" TEXT,
    "wiki_pages" INTEGER,
    "diagram" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "repo_id" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_installations_installation_id_key" ON "github_installations"("installation_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_repo_id_key" ON "repositories"("github_repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_repo_id_path_key" ON "files"("repo_id", "path");

-- CreateIndex
CREATE INDEX "graph_nodes_repo_id_idx" ON "graph_nodes"("repo_id");

-- CreateIndex
CREATE INDEX "graph_nodes_file_id_idx" ON "graph_nodes"("file_id");

-- CreateIndex
CREATE INDEX "graph_edges_repo_id_idx" ON "graph_edges"("repo_id");

-- CreateIndex
CREATE INDEX "graph_edges_source_node_id_idx" ON "graph_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "graph_edges_target_node_id_idx" ON "graph_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "wiki_pages_repo_id_idx" ON "wiki_pages"("repo_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_pages_repo_id_path_key" ON "wiki_pages"("repo_id", "path");

-- CreateIndex
CREATE INDEX "diagrams_repo_id_idx" ON "diagrams"("repo_id");

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status");

-- CreateIndex
CREATE INDEX "generation_jobs_user_id_idx" ON "generation_jobs"("user_id");

-- CreateIndex
CREATE INDEX "generation_jobs_repo_id_idx" ON "generation_jobs"("repo_id");

-- CreateIndex
CREATE INDEX "llm_usage_user_id_created_at_idx" ON "llm_usage"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

