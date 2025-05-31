-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('CONTENT_MANAGEMENT', 'SOCIAL_FEATURES', 'AI_FEATURES', 'ORGANIZATION', 'ANALYTICS', 'ADMIN_TOOLS', 'LIMITS');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('BOOLEAN', 'NUMERIC_LIMIT', 'QUOTA', 'CUSTOM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscriptionCancelledAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "SubscriptionTier";

-- CreateTable
CREATE TABLE "features" (
    "featureId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "description" TEXT,
    "category" "FeatureCategory" NOT NULL,
    "featureType" "FeatureType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("featureId")
);

-- CreateTable
CREATE TABLE "pricing_tier_features" (
    "id" TEXT NOT NULL,
    "pricingTierId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" INTEGER,
    "configValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_tier_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "features_featureKey_key" ON "features"("featureKey");

-- CreateIndex
CREATE INDEX "features_featureKey_idx" ON "features"("featureKey");

-- CreateIndex
CREATE INDEX "features_category_idx" ON "features"("category");

-- CreateIndex
CREATE INDEX "features_isActive_idx" ON "features"("isActive");

-- CreateIndex
CREATE INDEX "pricing_tier_features_pricingTierId_idx" ON "pricing_tier_features"("pricingTierId");

-- CreateIndex
CREATE INDEX "pricing_tier_features_featureId_idx" ON "pricing_tier_features"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tier_features_pricingTierId_featureId_key" ON "pricing_tier_features"("pricingTierId", "featureId");

-- AddForeignKey
ALTER TABLE "pricing_tier_features" ADD CONSTRAINT "pricing_tier_features_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "subscription_pricing"("pricingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tier_features" ADD CONSTRAINT "pricing_tier_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("featureId") ON DELETE CASCADE ON UPDATE CASCADE;
