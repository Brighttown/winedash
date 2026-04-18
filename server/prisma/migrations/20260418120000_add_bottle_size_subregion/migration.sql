-- AlterTable Wine: add subregion, bottle_size, make sell_price nullable
ALTER TABLE "Wine" ADD COLUMN "subregion" TEXT;
ALTER TABLE "Wine" ADD COLUMN "bottle_size" TEXT;
ALTER TABLE "Wine" ALTER COLUMN "sell_price" DROP NOT NULL;

-- AlterTable WineCatalog: add subregion, bottle_size
ALTER TABLE "WineCatalog" ADD COLUMN "subregion" TEXT;
ALTER TABLE "WineCatalog" ADD COLUMN "bottle_size" TEXT;
