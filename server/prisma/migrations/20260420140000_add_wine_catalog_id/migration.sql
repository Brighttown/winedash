-- AlterTable Wine: add catalog_id foreign key
ALTER TABLE "Wine" ADD COLUMN "catalog_id" TEXT;
ALTER TABLE "Wine" ADD CONSTRAINT "Wine_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "WineCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill catalog_id where name matches
UPDATE "Wine" w
SET catalog_id = c.id
FROM "WineCatalog" c
WHERE LOWER(TRIM(w.name)) = LOWER(TRIM(c.name))
  AND w.catalog_id IS NULL;
