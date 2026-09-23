-- CreateTable
CREATE TABLE "racm_excel_column_mappings" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "template_id" INTEGER NOT NULL,
    "column_mapping" JSONB NOT NULL,
    "assertion_yes_no_mapping" JSONB,
    "control_frequency_value_mapping" JSONB,
    "excel_headers" JSONB,
    "created_by" VARCHAR(255),
    "updated_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),
    "last_used_at" TIMESTAMP(6),

    CONSTRAINT "racm_excel_column_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "racm_excel_column_mappings_company_unit_template_idx" ON "racm_excel_column_mappings"("company_identifier", "unit_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "racm_excel_column_mappings_company_unit_name_key" ON "racm_excel_column_mappings"("company_identifier", "unit_id", "name");

-- AddForeignKey
ALTER TABLE "racm_excel_column_mappings" ADD CONSTRAINT "racm_excel_column_mappings_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_excel_column_mappings" ADD CONSTRAINT "racm_excel_column_mappings_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_excel_column_mappings" ADD CONSTRAINT "racm_excel_column_mappings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "racm_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
