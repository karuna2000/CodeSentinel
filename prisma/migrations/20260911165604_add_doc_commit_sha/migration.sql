-- AlterTable
ALTER TABLE "diagrams" ADD COLUMN     "commit_sha" TEXT;

-- AlterTable
ALTER TABLE "wiki_pages" ADD COLUMN     "commit_sha" TEXT;
