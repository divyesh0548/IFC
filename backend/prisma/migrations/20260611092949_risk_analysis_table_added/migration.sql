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
CREATE TABLE "risk_analysis" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "control_number" VARCHAR(255) NOT NULL,
    "form_id" VARCHAR(255),
    "business_process" VARCHAR(255),
    "sub_process" VARCHAR(255),
    "source_master_file" VARCHAR(1024),
    "model_name" VARCHAR(255) NOT NULL,
    "prompt_version" VARCHAR(100) NOT NULL,
    "matched_sub_process" VARCHAR(255),
    "match_confidence" VARCHAR(50),
    "coverage_status" VARCHAR(50),
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "risk_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_analysis_company_identifier_business_process_idx" ON "risk_analysis"("company_identifier", "business_process");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_company_identifier_control_number_key" ON "risk_analysis"("company_identifier", "control_number");
