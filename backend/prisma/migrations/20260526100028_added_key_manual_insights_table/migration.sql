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

-- CreateTable
CREATE TABLE "key_manual_ai_insights_run_table" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "model_name" VARCHAR(255) NOT NULL,
    "prompt_version" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "key_manual_ai_insights_run_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_manual_ai_insights_row_data" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "form_id" VARCHAR(255),
    "control_number" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255),
    "rationalisation_opportunity" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "key_manual_ai_insights_row_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_run_table_company_identifier_idx" ON "key_manual_ai_insights_run_table"("company_identifier");

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_row_data_run_id_idx" ON "key_manual_ai_insights_row_data"("run_id");

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_row_data_company_identifier_business_idx" ON "key_manual_ai_insights_row_data"("company_identifier", "business_process");

-- CreateIndex
CREATE UNIQUE INDEX "key_manual_ai_insights_row_data_company_identifier_control__key" ON "key_manual_ai_insights_row_data"("company_identifier", "control_number");

-- AddForeignKey
ALTER TABLE "key_manual_ai_insights_row_data" ADD CONSTRAINT "key_manual_ai_insights_row_data_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "key_manual_ai_insights_run_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
