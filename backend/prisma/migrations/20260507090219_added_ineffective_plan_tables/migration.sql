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
CREATE TABLE "compensatory_racm" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "explaination" TEXT,
    "document_url" VARCHAR(255),

    CONSTRAINT "compensatory_racm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitigation_plan" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "explaination" TEXT,
    "due_date" DATE,
    "concerned_person" VARCHAR(255),

    CONSTRAINT "mitigation_plan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "compensatory_racm" ADD CONSTRAINT "compensatory_racm_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitigation_plan" ADD CONSTRAINT "mitigation_plan_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;
