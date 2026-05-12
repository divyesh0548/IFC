-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "businees_process_code" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

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
CREATE TABLE "control_form_history" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "reason_by_approver" TEXT,
    "rejection_timestamp" TIMESTAMP(6),

    CONSTRAINT "control_form_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "control_form_history" ADD CONSTRAINT "control_form_history_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;
