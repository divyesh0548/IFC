-- DropIndex
DROP INDEX "approver_assignments_company_identifier_business_process_idx";

-- DropIndex
DROP INDEX "approver_assignments_company_identifier_form_id_idx";

-- DropIndex
DROP INDEX "approver_assignments_company_identifier_unit_id_idx";

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
ALTER TABLE "control_forms" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "coordinator_unit_assignments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "doc_uploaded_by_user" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_unit_memberships" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_scope_unit_idx" ON "approver_assignments"("company_identifier", "assignment_scope", "unit_id");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_scope_unit_process_idx" ON "approver_assignments"("company_identifier", "assignment_scope", "unit_id", "business_process");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_scope_form_idx" ON "approver_assignments"("company_identifier", "assignment_scope", "form_id");
