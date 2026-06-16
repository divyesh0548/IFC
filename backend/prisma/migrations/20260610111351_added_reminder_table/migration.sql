/*
  Warnings:

  - You are about to drop the column `reminder_datetime` on the `control_forms` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_process_master" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "control_forms" DROP COLUMN "reminder_datetime",
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "doc_uploaded_by_user" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "controls_reminder" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "reminder_datetime" TIMESTAMP(6),
    "reminder_to_approver_datetime" TIMESTAMP(6),
    "ineffective_reminder_datetime" TIMESTAMP(6),
    "deficiency_review_reminder_datetime" TIMESTAMP(6),

    CONSTRAINT "controls_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "controls_reminder_form_id_key" ON "controls_reminder"("form_id");

-- AddForeignKey
ALTER TABLE "controls_reminder" ADD CONSTRAINT "controls_reminder_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;
