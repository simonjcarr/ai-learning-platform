-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "chat_messages" (
    "messageId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "exampleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "article_likes" (
    "likeId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_likes_pkey" PRIMARY KEY ("likeId")
);

-- CreateTable
CREATE TABLE "curated_lists" (
    "listId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curated_lists_pkey" PRIMARY KEY ("listId")
);

-- CreateTable
CREATE TABLE "curated_list_items" (
    "itemId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curated_list_items_pkey" PRIMARY KEY ("itemId")
);

-- CreateIndex
CREATE INDEX "chat_messages_articleId_clerkUserId_idx" ON "chat_messages"("articleId", "clerkUserId");

-- CreateIndex
CREATE INDEX "chat_messages_exampleId_idx" ON "chat_messages"("exampleId");

-- CreateIndex
CREATE INDEX "article_likes_clerkUserId_idx" ON "article_likes"("clerkUserId");

-- CreateIndex
CREATE INDEX "article_likes_articleId_idx" ON "article_likes"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "article_likes_articleId_clerkUserId_key" ON "article_likes"("articleId", "clerkUserId");

-- CreateIndex
CREATE INDEX "curated_lists_clerkUserId_idx" ON "curated_lists"("clerkUserId");

-- CreateIndex
CREATE INDEX "curated_lists_isPublic_idx" ON "curated_lists"("isPublic");

-- CreateIndex
CREATE INDEX "curated_list_items_listId_idx" ON "curated_list_items"("listId");

-- CreateIndex
CREATE INDEX "curated_list_items_articleId_idx" ON "curated_list_items"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "curated_list_items_listId_articleId_key" ON "curated_list_items"("listId", "articleId");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_lists" ADD CONSTRAINT "curated_lists_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_list_items" ADD CONSTRAINT "curated_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "curated_lists"("listId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_list_items" ADD CONSTRAINT "curated_list_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE RESTRICT ON UPDATE CASCADE;
