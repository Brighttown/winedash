-- AlterTable Wine: make vintage nullable for non-vintage (NV) wines
ALTER TABLE "Wine" ALTER COLUMN "vintage" DROP NOT NULL;
