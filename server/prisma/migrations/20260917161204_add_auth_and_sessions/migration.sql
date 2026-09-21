/*
  Warnings:

  - A unique constraint covering the columns `[emailNormalized]` on the table `requester_user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- DropIndex
ALTER TABLE "requester_user" DROP CONSTRAINT "requester_user_email_key";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "ownerId" INTEGER;

-- AlterTable
ALTER TABLE "requester_user" ADD COLUMN     "emailNormalized" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'REQUESTER';

UPDATE "requester_user"
SET "emailNormalized" = lower("email"),
    "passwordHash" = '$2b$12$MvQuSTNtpiuJmfaKc7j0Nu0FipBQuY31F6ojkIMWw2OMTZoK5lUkq';

ALTER TABLE "requester_user"
ALTER COLUMN "emailNormalized" SET NOT NULL,
ALTER COLUMN "passwordHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "requester_user_emailNormalized_key" ON "requester_user"("emailNormalized");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "requester_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "requester_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
