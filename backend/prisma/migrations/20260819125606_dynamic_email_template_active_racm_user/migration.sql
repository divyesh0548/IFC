-- CreateTable
CREATE TABLE "company_email_templates" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "email_subject" TEXT,
    "email_body" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "company_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_email_templates_company_identifier_idx" ON "company_email_templates"("company_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "company_email_templates_company_identifier_unit_id_key" ON "company_email_templates"("company_identifier", "unit_id");
