-- CreateTable
CREATE TABLE "tags" (
    "tagId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("tagId")
);

-- CreateTable
CREATE TABLE "article_tags" (
    "articleTagId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_tags_pkey" PRIMARY KEY ("articleTagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_tagName_key" ON "tags"("tagName");

-- CreateIndex
CREATE INDEX "tags_tagName_idx" ON "tags"("tagName");

-- CreateIndex
CREATE INDEX "article_tags_articleId_idx" ON "article_tags"("articleId");

-- CreateIndex
CREATE INDEX "article_tags_tagId_idx" ON "article_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "article_tags_articleId_tagId_key" ON "article_tags"("articleId", "tagId");

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("tagId") ON DELETE CASCADE ON UPDATE CASCADE;
