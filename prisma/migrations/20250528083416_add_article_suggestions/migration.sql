-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('CONTENT_ADDITION', 'CONTENT_CORRECTION', 'GRAMMAR_SPELLING', 'CODE_IMPROVEMENT', 'CLARITY_IMPROVEMENT', 'EXAMPLE_ADDITION', 'LINK_UPDATE', 'OTHER');

-- CreateTable
CREATE TABLE "article_suggestions" (
    "suggestionId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "suggestionType" "SuggestionType" NOT NULL,
    "suggestionDetails" TEXT NOT NULL,
    "aiValidationResponse" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "aiInteractionId" TEXT,

    CONSTRAINT "article_suggestions_pkey" PRIMARY KEY ("suggestionId")
);

-- CreateTable
CREATE TABLE "suggestion_rate_limits" (
    "rateLimitId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "lastSuggestionAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_rate_limits_pkey" PRIMARY KEY ("rateLimitId")
);

-- CreateTable
CREATE TABLE "suggestion_settings" (
    "settingsId" TEXT NOT NULL,
    "rateLimitMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxSuggestionsPerUser" INTEGER NOT NULL DEFAULT 10,
    "badgeThresholds" JSONB NOT NULL DEFAULT '{"bronze": 5, "silver": 10, "gold": 25}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_settings_pkey" PRIMARY KEY ("settingsId")
);

-- CreateIndex
CREATE INDEX "article_suggestions_articleId_idx" ON "article_suggestions"("articleId");

-- CreateIndex
CREATE INDEX "article_suggestions_clerkUserId_idx" ON "article_suggestions"("clerkUserId");

-- CreateIndex
CREATE INDEX "article_suggestions_isApproved_idx" ON "article_suggestions"("isApproved");

-- CreateIndex
CREATE INDEX "article_suggestions_suggestedAt_idx" ON "article_suggestions"("suggestedAt");

-- CreateIndex
CREATE INDEX "suggestion_rate_limits_clerkUserId_idx" ON "suggestion_rate_limits"("clerkUserId");

-- CreateIndex
CREATE INDEX "suggestion_rate_limits_articleId_idx" ON "suggestion_rate_limits"("articleId");

-- CreateIndex
CREATE INDEX "suggestion_rate_limits_lastSuggestionAt_idx" ON "suggestion_rate_limits"("lastSuggestionAt");

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_rate_limits_clerkUserId_articleId_key" ON "suggestion_rate_limits"("clerkUserId", "articleId");

-- AddForeignKey
ALTER TABLE "article_suggestions" ADD CONSTRAINT "article_suggestions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_suggestions" ADD CONSTRAINT "article_suggestions_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_rate_limits" ADD CONSTRAINT "suggestion_rate_limits_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE CASCADE ON UPDATE CASCADE;
