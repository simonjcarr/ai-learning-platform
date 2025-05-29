-- CreateTable
CREATE TABLE "article_groups" (
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_groups_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "article_group_articles" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "scrollPosition" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "article_group_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_groups_clerkUserId_idx" ON "article_groups"("clerkUserId");

-- CreateIndex
CREATE INDEX "article_group_articles_groupId_idx" ON "article_group_articles"("groupId");

-- CreateIndex
CREATE INDEX "article_group_articles_articleId_idx" ON "article_group_articles"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "article_group_articles_groupId_articleId_key" ON "article_group_articles"("groupId", "articleId");

-- AddForeignKey
ALTER TABLE "article_groups" ADD CONSTRAINT "article_groups_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_group_articles" ADD CONSTRAINT "article_group_articles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "article_groups"("groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_group_articles" ADD CONSTRAINT "article_group_articles_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;
