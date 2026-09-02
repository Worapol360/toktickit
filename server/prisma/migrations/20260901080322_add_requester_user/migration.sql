-- DropIndex
DROP INDEX "requester_user_name_id_idx";

-- AlterTable
ALTER TABLE "requester_user" ALTER COLUMN "updatedAt" DROP DEFAULT;
