-- Additive governed learning memory. Does not alter memory_items.
CREATE TABLE IF NOT EXISTS "governed_memory_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "provenance" JSONB NOT NULL,
    "source_trust" DOUBLE PRECISION NOT NULL,
    "fact_confidence" DOUBLE PRECISION,
    "extraction_confidence" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL DEFAULT 'normal',
    "expires_at" TIMESTAMP(3),
    "lineage_ids" JSONB NOT NULL,
    "source_id" TEXT,
    "superseded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "governed_memory_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governed_memory_records_tenant_id_subject_id_status_idx"
  ON "governed_memory_records"("tenant_id", "subject_id", "status");
CREATE INDEX IF NOT EXISTS "governed_memory_records_tenant_id_scope_status_idx"
  ON "governed_memory_records"("tenant_id", "scope", "status");
CREATE INDEX IF NOT EXISTS "governed_memory_records_expires_at_idx"
  ON "governed_memory_records"("expires_at");
