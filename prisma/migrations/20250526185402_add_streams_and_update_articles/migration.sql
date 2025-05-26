-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_categoryId_fkey";

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "streamId" TEXT,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "channels" (
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("channelId")
);

-- CreateTable
CREATE TABLE "streams" (
    "streamId" TEXT NOT NULL,
    "streamName" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("streamId")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_channelName_key" ON "channels"("channelName");

-- CreateIndex
CREATE INDEX "channels_channelName_idx" ON "channels"("channelName");

-- CreateIndex
CREATE INDEX "streams_streamName_idx" ON "streams"("streamName");

-- CreateIndex
CREATE INDEX "streams_channelId_idx" ON "streams"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "streams_channelId_streamName_key" ON "streams"("channelId", "streamName");

-- CreateIndex
CREATE INDEX "articles_streamId_idx" ON "articles"("streamId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("categoryId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("streamId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("channelId") ON DELETE RESTRICT ON UPDATE CASCADE;
