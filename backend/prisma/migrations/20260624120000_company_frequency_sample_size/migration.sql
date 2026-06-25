-- CreateTable
CREATE TABLE "company_frequency_sample_size" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "frequency_key" VARCHAR(50) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "updated_by" VARCHAR(255),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "company_frequency_sample_size_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_frequency_sample_size_company_unit_freq_key" ON "company_frequency_sample_size"("company_identifier", "unit_id", "frequency_key");

-- CreateIndex
CREATE INDEX "company_frequency_sample_size_company_unit_idx" ON "company_frequency_sample_size"("company_identifier", "unit_id");

-- AddForeignKey
ALTER TABLE "company_frequency_sample_size" ADD CONSTRAINT "company_frequency_sample_size_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;
