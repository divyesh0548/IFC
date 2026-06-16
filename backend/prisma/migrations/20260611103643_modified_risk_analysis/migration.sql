/*
  Warnings:

  - You are about to drop the column `control_number` on the `risk_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `prompt_version` on the `risk_analysis` table. All the data in the column will be lost.
  - You are about to drop the column `source_master_file` on the `risk_analysis` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[company_identifier,form_id]` on the table `risk_analysis` will be added. If there are existing duplicate values, this will fail.
  - Made the column `form_id` on table `risk_analysis` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "risk_analysis_company_identifier_control_number_key";

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
ALTER TABLE "risk_analysis" DROP COLUMN "control_number",
DROP COLUMN "prompt_version",
DROP COLUMN "source_master_file",
ALTER COLUMN "form_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_company_identifier_form_id_key" ON "risk_analysis"("company_identifier", "form_id");
