-- CreateTable
CREATE TABLE "article_change_histories" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "beforeContent" TEXT NOT NULL,
    "afterContent" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_change_histories_suggestionId_key" ON "article_change_histories"("suggestionId");

-- CreateIndex
CREATE INDEX "article_change_histories_articleId_idx" ON "article_change_histories"("articleId");

-- CreateIndex
CREATE INDEX "article_change_histories_clerkUserId_idx" ON "article_change_histories"("clerkUserId");

-- CreateIndex
CREATE INDEX "article_change_histories_isActive_idx" ON "article_change_histories"("isActive");

-- CreateIndex
CREATE INDEX "article_change_histories_createdAt_idx" ON "article_change_histories"("createdAt");

-- AddForeignKey
ALTER TABLE "article_change_histories" ADD CONSTRAINT "article_change_histories_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_change_histories" ADD CONSTRAINT "article_change_histories_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "article_suggestions"("suggestionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_change_histories" ADD CONSTRAINT "article_change_histories_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_change_histories" ADD CONSTRAINT "article_change_histories_rolledBackBy_fkey" FOREIGN KEY ("rolledBackBy") REFERENCES "users"("clerkUserId") ON DELETE SET NULL ON UPDATE CASCADE;
