/*
  Warnings:

  - You are about to drop the `doc_uploaded_by_user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "doc_uploaded_by_user" DROP CONSTRAINT "doc_uploaded_by_user_form_id_fkey";

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
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_unit_memberships" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "doc_uploaded_by_user";

-- CreateTable
CREATE TABLE "racm_docs" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "doc_uploaded_by_user" VARCHAR(255),
    "user_id" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "racm_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "racm_docs_form_id_idx" ON "racm_docs"("form_id");

-- CreateIndex
CREATE INDEX "racm_docs_user_id_idx" ON "racm_docs"("user_id");

-- AddForeignKey
ALTER TABLE "racm_docs" ADD CONSTRAINT "racm_docs_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;
