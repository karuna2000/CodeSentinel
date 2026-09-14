-- CreateTable
CREATE TABLE "trace_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "user_id" TEXT,
    "repo_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trace_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trace_events_name_created_at_idx" ON "trace_events"("name", "created_at");

-- CreateIndex
CREATE INDEX "trace_events_repo_id_created_at_idx" ON "trace_events"("repo_id", "created_at");
