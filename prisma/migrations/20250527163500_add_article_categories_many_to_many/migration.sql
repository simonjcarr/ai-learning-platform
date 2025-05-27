-- CreateTable
CREATE TABLE "article_categories" (
    "articleCategoryId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("articleCategoryId")
);

-- CreateIndex
CREATE INDEX "article_categories_articleId_idx" ON "article_categories"("articleId");

-- CreateIndex
CREATE INDEX "article_categories_categoryId_idx" ON "article_categories"("categoryId");

-- CreateIndex
CREATE INDEX "article_categories_isPrimary_idx" ON "article_categories"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_articleId_categoryId_key" ON "article_categories"("articleId", "categoryId");

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data
INSERT INTO "article_categories" ("articleCategoryId", "articleId", "categoryId", "isPrimary", "createdAt")
SELECT gen_random_uuid(), "articleId", "categoryId", true, CURRENT_TIMESTAMP
FROM "articles"
WHERE "categoryId" IS NOT NULL;

-- Drop the old foreign key constraint
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_categoryId_fkey";

-- Drop the old index
DROP INDEX IF EXISTS "articles_categoryId_idx";

-- Drop the old column
ALTER TABLE "articles" DROP COLUMN "categoryId";