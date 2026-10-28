-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "action_taken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "followUpCompletedAt" TIMESTAMP(3),
    "attachmentNotes" TEXT,
    "clientRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "performedById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_taken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_taken_ticketId_createdAt_id_idx" ON "action_taken"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "action_taken_performedById_followUpRequired_followUpComplet_idx" ON "action_taken"("performedById", "followUpRequired", "followUpCompletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "action_taken_ticketId_clientRequestId_key" ON "action_taken"("ticketId", "clientRequestId");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_status_idx" ON "Ticket"("requesterId", "status");

-- CreateIndex
CREATE INDEX "Ticket_status_updatedAt_idx" ON "Ticket"("status", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "requester_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_taken" ADD CONSTRAINT "action_taken_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "requester_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: record when a legacy Resolved ticket was marked resolved
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" WHERE "status" = 'Resolved' AND "resolvedAt" IS NULL;