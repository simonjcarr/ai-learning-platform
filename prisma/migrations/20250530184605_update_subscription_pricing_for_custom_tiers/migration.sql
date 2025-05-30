/*
  Warnings:

  - The `previousTier` column on the `subscription_history` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `subscriptionTier` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `newTier` on the `subscription_history` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `tier` on the `subscription_pricing` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "subscription_history" DROP COLUMN "previousTier",
ADD COLUMN     "previousTier" TEXT,
DROP COLUMN "newTier",
ADD COLUMN     "newTier" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscription_pricing" ADD COLUMN     "freeTrialDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeProductId" TEXT,
DROP COLUMN "tier",
ADD COLUMN     "tier" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "subscriptionTier",
ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE';

-- CreateIndex
CREATE UNIQUE INDEX "subscription_pricing_tier_key" ON "subscription_pricing"("tier");

-- CreateIndex
CREATE INDEX "subscription_pricing_tier_idx" ON "subscription_pricing"("tier");
