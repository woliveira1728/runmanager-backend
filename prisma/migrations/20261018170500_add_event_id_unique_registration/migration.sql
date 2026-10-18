-- AlterTable: add event_id to registrations and backfill from batch->modality if rows exist
ALTER TABLE "registrations" ADD COLUMN "event_id" UUID;

UPDATE "registrations" r
SET "event_id" = m."event_id"
FROM "registration_batches" rb
JOIN "modalities" m ON rb."modality_id" = m."id"
WHERE r."batch_id" = rb."id" AND r."event_id" IS NULL;

ALTER TABLE "registrations" ALTER COLUMN "event_id" SET NOT NULL;

-- CreateIndex: UNIQUE(event_id, athlete_id) conforme DER da AP2
CREATE UNIQUE INDEX "registrations_event_id_athlete_id_key" ON "registrations"("event_id", "athlete_id");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
