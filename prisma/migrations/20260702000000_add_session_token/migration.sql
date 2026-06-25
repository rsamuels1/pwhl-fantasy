-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
