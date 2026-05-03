-- Add config JSON column to POSIntegration
ALTER TABLE "POSIntegration" ADD COLUMN "config" JSONB;

-- POSCatalogItem
CREATE TABLE "POSCatalogItem" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price" DOUBLE PRECISION,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POSCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "POSCatalogItem_integration_id_external_id_key"
    ON "POSCatalogItem"("integration_id", "external_id");

CREATE INDEX "POSCatalogItem_integration_id_name_idx"
    ON "POSCatalogItem"("integration_id", "name");

ALTER TABLE "POSCatalogItem" ADD CONSTRAINT "POSCatalogItem_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "POSIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- POSProductMapping
CREATE TABLE "POSProductMapping" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "wine_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'bottle',
    "units_per_sale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSProductMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "POSProductMapping_integration_id_external_id_unit_key"
    ON "POSProductMapping"("integration_id", "external_id", "unit");

CREATE INDEX "POSProductMapping_wine_id_idx" ON "POSProductMapping"("wine_id");

ALTER TABLE "POSProductMapping" ADD CONSTRAINT "POSProductMapping_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "POSIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "POSProductMapping" ADD CONSTRAINT "POSProductMapping_wine_id_fkey"
    FOREIGN KEY ("wine_id") REFERENCES "Wine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
