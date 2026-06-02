/*
  Warnings:

  - A unique constraint covering the columns `[company_identifier,run_id,control_number]` on the table `key_manual_ai_insights_row_data` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "key_manual_ai_insights_row_data_company_identifier_control__key";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_process_master" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "control_forms" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "doc_uploaded_by_user" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "key_manual_ai_insights_row_data_company_identifier_run_id_c_key" ON "key_manual_ai_insights_row_data"("company_identifier", "run_id", "control_number");
