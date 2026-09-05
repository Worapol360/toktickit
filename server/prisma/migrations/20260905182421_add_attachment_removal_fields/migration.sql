/*
  Warnings:

  - You are about to alter the column `removalReason` on the `Attachment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(250)`.

*/
-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "removedAt" TIMESTAMP(3),
ALTER COLUMN "removalReason" SET DATA TYPE VARCHAR(250);
