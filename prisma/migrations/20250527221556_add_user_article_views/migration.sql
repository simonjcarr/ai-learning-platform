-- CreateTable
CREATE TABLE "user_article_views" (
    "viewId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_article_views_pkey" PRIMARY KEY ("viewId")
);

-- CreateIndex
CREATE INDEX "user_article_views_clerkUserId_idx" ON "user_article_views"("clerkUserId");

-- CreateIndex
CREATE INDEX "user_article_views_articleId_idx" ON "user_article_views"("articleId");

-- CreateIndex
CREATE INDEX "user_article_views_viewedAt_idx" ON "user_article_views"("viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_article_views_clerkUserId_articleId_key" ON "user_article_views"("clerkUserId", "articleId");

-- AddForeignKey
ALTER TABLE "user_article_views" ADD CONSTRAINT "user_article_views_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_article_views" ADD CONSTRAINT "user_article_views_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;
