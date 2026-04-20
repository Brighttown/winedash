-- Step 1: Create catalog entries for any wines still without catalog_id
INSERT INTO "WineCatalog" (id, name, type, region, country, grape, is_verified, created_at)
SELECT
  gen_random_uuid(),
  w.name,
  COALESCE(w.type, 'red'),
  COALESCE(w.region, 'Onbekend'),
  COALESCE(w.country, 'Onbekend'),
  COALESCE(w.grape, ''),
  false,
  now()
FROM "Wine" w
WHERE w.catalog_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- Step 2: Link remaining unlinked wines by name
UPDATE "Wine" w
SET catalog_id = c.id
FROM "WineCatalog" c
WHERE LOWER(TRIM(w.name)) = LOWER(TRIM(c.name))
  AND w.catalog_id IS NULL;

-- Step 3: Make catalog_id NOT NULL
ALTER TABLE "Wine" ALTER COLUMN "catalog_id" SET NOT NULL;

-- Step 4: Drop duplicate metadata columns from Wine
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "type";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "region";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "subregion";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "country";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "grape";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "winery";
ALTER TABLE "Wine" DROP COLUMN IF EXISTS "bottle_size";
