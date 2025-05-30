-- AlterTable
ALTER TABLE "subscription_pricing" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "subscription_pricing_displayOrder_idx" ON "subscription_pricing"("displayOrder");
