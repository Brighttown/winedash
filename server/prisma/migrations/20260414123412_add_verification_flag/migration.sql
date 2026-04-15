-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WineCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "vintage" INTEGER,
    "grape" TEXT,
    "type" TEXT NOT NULL,
    "image_url" TEXT,
    "elaborate" TEXT,
    "harmonize" TEXT,
    "abv" REAL,
    "body" TEXT,
    "acidity" TEXT,
    "winery" TEXT,
    "website" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WineCatalog" ("abv", "acidity", "body", "country", "created_at", "elaborate", "grape", "harmonize", "id", "image_url", "name", "region", "type", "vintage", "website", "winery") SELECT "abv", "acidity", "body", "country", "created_at", "elaborate", "grape", "harmonize", "id", "image_url", "name", "region", "type", "vintage", "website", "winery" FROM "WineCatalog";
DROP TABLE "WineCatalog";
ALTER TABLE "new_WineCatalog" RENAME TO "WineCatalog";
CREATE UNIQUE INDEX "WineCatalog_name_key" ON "WineCatalog"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
