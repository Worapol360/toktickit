-- Add itPriority column to Ticket (nullable, backfill from requestedPriority)
ALTER TABLE "Ticket" ADD COLUMN "itPriority" TEXT;
UPDATE "Ticket" SET "itPriority" = "requestedPriority";

-- Add requesterMarkedResolved column to Ticket
ALTER TABLE "Ticket" ADD COLUMN "requesterMarkedResolved" BOOLEAN NOT NULL DEFAULT false;

-- Add composite index for queue filtering
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");
