-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedByClerkUserId" TEXT,
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedByClerkUserId" TEXT,
ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "subscription_pricing" (
    "pricingId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "yearlyPriceCents" INTEGER NOT NULL,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pricing_pkey" PRIMARY KEY ("pricingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_pricing_tier_key" ON "subscription_pricing"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_pricing_stripePriceId_key" ON "subscription_pricing"("stripePriceId");

-- CreateIndex
CREATE INDEX "subscription_pricing_tier_idx" ON "subscription_pricing"("tier");

-- CreateIndex
CREATE INDEX "articles_isFlagged_idx" ON "articles"("isFlagged");

-- CreateIndex
CREATE INDEX "comments_isFlagged_idx" ON "comments"("isFlagged");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_flaggedByClerkUserId_fkey" FOREIGN KEY ("flaggedByClerkUserId") REFERENCES "users"("clerkUserId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_flaggedByClerkUserId_fkey" FOREIGN KEY ("flaggedByClerkUserId") REFERENCES "users"("clerkUserId") ON DELETE SET NULL ON UPDATE CASCADE;
