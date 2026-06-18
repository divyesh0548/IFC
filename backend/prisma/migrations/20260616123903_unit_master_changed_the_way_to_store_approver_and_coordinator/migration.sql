/*
  Warnings:

  - You are about to drop the column `approver_email_id` on the `company_unit_master` table. All the data in the column will be lost.
  - You are about to drop the column `coordinator_email_id` on the `company_unit_master` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[company_identifier,unit_id]` on the table `company_unit_master` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UnitResponsibilityType" AS ENUM ('COORDINATOR', 'APPROVER');

-- DropForeignKey
ALTER TABLE "control_forms" DROP CONSTRAINT "control_forms_unit_id_fkey";

-- DropIndex
DROP INDEX "company_unit_master_unit_id_key";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_process_master" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "company_unit_master" DROP COLUMN "approver_email_id",
DROP COLUMN "coordinator_email_id";

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

-- CreateTable
CREATE TABLE "company_unit_responsibilities" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "user_email_id" VARCHAR(255) NOT NULL,
    "responsibility_type" "UnitResponsibilityType" NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_unit_responsibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_unit_responsibilities_company_identifier_user_email_idx" ON "company_unit_responsibilities"("company_identifier", "user_email_id", "responsibility_type");

-- CreateIndex
CREATE UNIQUE INDEX "company_unit_responsibilities_company_identifier_unit_id_re_key" ON "company_unit_responsibilities"("company_identifier", "unit_id", "responsibility_type");

-- CreateIndex
CREATE UNIQUE INDEX "company_unit_master_company_identifier_unit_id_key" ON "company_unit_master"("company_identifier", "unit_id");

-- AddForeignKey
ALTER TABLE "company_unit_responsibilities" ADD CONSTRAINT "company_unit_responsibilities_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_unit_responsibilities" ADD CONSTRAINT "company_unit_responsibilities_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE SET NULL ON UPDATE CASCADE;
