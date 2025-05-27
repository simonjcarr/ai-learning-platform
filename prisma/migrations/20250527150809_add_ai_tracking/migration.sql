-- CreateTable
CREATE TABLE "ai_models" (
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "apiKey" TEXT NOT NULL,
    "inputTokenCostPer1M" DECIMAL(10,6) NOT NULL,
    "outputTokenCostPer1M" DECIMAL(10,6) NOT NULL,
    "maxTokens" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("modelId")
);

-- CreateTable
CREATE TABLE "ai_interaction_types" (
    "typeId" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "defaultModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_interaction_types_pkey" PRIMARY KEY ("typeId")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "interactionId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "modelId" TEXT NOT NULL,
    "interactionTypeId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "inputTokenCost" DECIMAL(10,8) NOT NULL,
    "outputTokenCost" DECIMAL(10,8) NOT NULL,
    "totalCost" DECIMAL(10,8) NOT NULL,
    "prompt" TEXT,
    "response" TEXT,
    "contextData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "isSuccessful" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("interactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_modelName_key" ON "ai_models"("modelName");

-- CreateIndex
CREATE INDEX "ai_models_provider_idx" ON "ai_models"("provider");

-- CreateIndex
CREATE INDEX "ai_models_isActive_idx" ON "ai_models"("isActive");

-- CreateIndex
CREATE INDEX "ai_models_isDefault_idx" ON "ai_models"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ai_interaction_types_typeName_key" ON "ai_interaction_types"("typeName");

-- CreateIndex
CREATE INDEX "ai_interaction_types_typeName_idx" ON "ai_interaction_types"("typeName");

-- CreateIndex
CREATE INDEX "ai_interactions_clerkUserId_idx" ON "ai_interactions"("clerkUserId");

-- CreateIndex
CREATE INDEX "ai_interactions_modelId_idx" ON "ai_interactions"("modelId");

-- CreateIndex
CREATE INDEX "ai_interactions_interactionTypeId_idx" ON "ai_interactions"("interactionTypeId");

-- CreateIndex
CREATE INDEX "ai_interactions_startedAt_idx" ON "ai_interactions"("startedAt");

-- CreateIndex
CREATE INDEX "ai_interactions_isSuccessful_idx" ON "ai_interactions"("isSuccessful");

-- AddForeignKey
ALTER TABLE "ai_interaction_types" ADD CONSTRAINT "ai_interaction_types_defaultModelId_fkey" FOREIGN KEY ("defaultModelId") REFERENCES "ai_models"("modelId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "users"("clerkUserId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("modelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_interactionTypeId_fkey" FOREIGN KEY ("interactionTypeId") REFERENCES "ai_interaction_types"("typeId") ON DELETE RESTRICT ON UPDATE CASCADE;
