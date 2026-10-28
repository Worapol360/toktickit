-- Lab 4, Issue 2 rollback: Actions Taken backend
-- Drops the action_taken table, the Ticket version/resolvedAt columns, and the
-- indexes introduced by migration 20261028110710_lab4_actions_taken.
-- Run against the target database with psql -f docs/lab-04/rollback.sql
-- Ticket rows created before the migration keep every earlier column; only the
-- Lab 4 additions (resolvedAt backfill included) are removed.

DROP TABLE IF EXISTS "action_taken";

DROP INDEX IF EXISTS "Ticket_status_updatedAt_idx";
DROP INDEX IF EXISTS "Ticket_requesterId_status_idx";

ALTER TABLE "Ticket"
  DROP COLUMN IF EXISTS "resolvedAt",
  DROP COLUMN IF EXISTS "version";

-- Remember to mark the migration as rolled back in Prisma afterwards:
--   npx prisma migrate resolve --rolled-back 20261028110710_lab4_actions_taken
