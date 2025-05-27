-- DropForeignKey
ALTER TABLE "article_likes" DROP CONSTRAINT "article_likes_clerkUserId_fkey";

-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_clerkUserId_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_clerkUserId_fkey";

-- DropForeignKey
ALTER TABLE "curated_lists" DROP CONSTRAINT "curated_lists_clerkUserId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_history" DROP CONSTRAINT "subscription_history_clerkUserId_fkey";

-- DropForeignKey
ALTER TABLE "user_responses" DROP CONSTRAINT "user_responses_clerkUserId_fkey";

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curated_lists" ADD CONSTRAINT "curated_lists_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;
