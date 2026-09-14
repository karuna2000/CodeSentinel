-- Isolate repositories per user so linking the same GitHub repo cannot steal another tenant's index.

DROP INDEX IF EXISTS "repositories_github_repo_id_key";

CREATE UNIQUE INDEX "repositories_user_id_github_repo_id_key" ON "repositories"("user_id", "github_repo_id");
CREATE INDEX "repositories_github_repo_id_idx" ON "repositories"("github_repo_id");
