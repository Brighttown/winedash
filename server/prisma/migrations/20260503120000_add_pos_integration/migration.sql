-- CreateTable
CREATE TABLE "POSIntegration" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "api_secret_enc" TEXT,
    "location_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "POSIntegration_company_id_idx" ON "POSIntegration"("company_id");

-- AddForeignKey
ALTER TABLE "POSIntegration" ADD CONSTRAINT "POSIntegration_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
