-- AlterTable
ALTER TABLE "approver_assignments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_process_master" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "control_forms" ADD COLUMN     "template_id" INTEGER,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "coordinator_unit_assignments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_unit_memberships" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "racm_templates" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "template_name" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "copied_from_template_id" INTEGER,
    "linked_racm_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "racm_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racm_template_fields" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "section_key" VARCHAR(50) NOT NULL,
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "excel_keywords" JSONB,

    CONSTRAINT "racm_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racm_field_values" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "template_field_id" INTEGER NOT NULL,
    "value_text" TEXT,

    CONSTRAINT "racm_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "racm_templates_company_identifier_unit_id_status_idx" ON "racm_templates"("company_identifier", "unit_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "racm_templates_company_identifier_unit_id_template_name_ver_key" ON "racm_templates"("company_identifier", "unit_id", "template_name", "version");

-- CreateIndex
CREATE INDEX "racm_template_fields_template_id_section_key_display_order_idx" ON "racm_template_fields"("template_id", "section_key", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "racm_template_fields_template_id_field_key_key" ON "racm_template_fields"("template_id", "field_key");

-- CreateIndex
CREATE INDEX "racm_field_values_form_id_idx" ON "racm_field_values"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "racm_field_values_form_id_template_field_id_key" ON "racm_field_values"("form_id", "template_field_id");

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "racm_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_templates" ADD CONSTRAINT "racm_templates_copied_from_template_id_fkey" FOREIGN KEY ("copied_from_template_id") REFERENCES "racm_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_templates" ADD CONSTRAINT "racm_templates_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_templates" ADD CONSTRAINT "racm_templates_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_template_fields" ADD CONSTRAINT "racm_template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "racm_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_field_values" ADD CONSTRAINT "racm_field_values_template_field_id_fkey" FOREIGN KEY ("template_field_id") REFERENCES "racm_template_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racm_field_values" ADD CONSTRAINT "racm_field_values_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;
