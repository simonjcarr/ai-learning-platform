-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TEXT_INPUT', 'COMMAND_LINE');

-- CreateTable
CREATE TABLE "users" (
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "appSpecificCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginToApp" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("clerkUserId")
);

-- CreateTable
CREATE TABLE "categories" (
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "articles" (
    "articleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "articleSlug" TEXT NOT NULL,
    "contentHtml" TEXT,
    "isContentGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdByClerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("articleId")
);

-- CreateTable
CREATE TABLE "interactive_examples" (
    "exampleId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "scenarioOrQuestionText" TEXT NOT NULL,
    "optionsJson" JSONB,
    "correctAnswerDescription" TEXT NOT NULL,
    "aiMarkingPromptHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactive_examples_pkey" PRIMARY KEY ("exampleId")
);

-- CreateTable
CREATE TABLE "user_responses" (
    "responseId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "exampleId" TEXT NOT NULL,
    "userAnswerText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "aiFeedback" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_responses_pkey" PRIMARY KEY ("responseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "categories_categoryName_key" ON "categories"("categoryName");

-- CreateIndex
CREATE INDEX "categories_categoryName_idx" ON "categories"("categoryName");

-- CreateIndex
CREATE UNIQUE INDEX "articles_articleSlug_key" ON "articles"("articleSlug");

-- CreateIndex
CREATE INDEX "articles_categoryId_idx" ON "articles"("categoryId");

-- CreateIndex
CREATE INDEX "articles_articleSlug_idx" ON "articles"("articleSlug");

-- CreateIndex
CREATE INDEX "articles_articleTitle_idx" ON "articles"("articleTitle");

-- CreateIndex
CREATE INDEX "articles_isContentGenerated_idx" ON "articles"("isContentGenerated");

-- CreateIndex
CREATE INDEX "articles_createdByClerkUserId_idx" ON "articles"("createdByClerkUserId");

-- CreateIndex
CREATE INDEX "interactive_examples_articleId_idx" ON "interactive_examples"("articleId");

-- CreateIndex
CREATE INDEX "user_responses_clerkUserId_idx" ON "user_responses"("clerkUserId");

-- CreateIndex
CREATE INDEX "user_responses_exampleId_idx" ON "user_responses"("exampleId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_createdByClerkUserId_fkey" FOREIGN KEY ("createdByClerkUserId") REFERENCES "users"("clerkUserId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactive_examples" ADD CONSTRAINT "interactive_examples_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("articleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_responses" ADD CONSTRAINT "user_responses_exampleId_fkey" FOREIGN KEY ("exampleId") REFERENCES "interactive_examples"("exampleId") ON DELETE RESTRICT ON UPDATE CASCADE;
