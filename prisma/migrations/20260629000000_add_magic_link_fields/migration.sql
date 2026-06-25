-- AlterTable
ALTER TABLE "User" ADD COLUMN "magicLinkToken" TEXT,
ADD COLUMN "magicLinkExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_magicLinkToken_key" ON "User"("magicLinkToken");
