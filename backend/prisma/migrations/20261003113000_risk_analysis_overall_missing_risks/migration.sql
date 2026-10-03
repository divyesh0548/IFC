-- CreateTable
CREATE TABLE "risk_analysis_overall_missing_risks" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "model_name" VARCHAR(255),
    "source_fingerprint" VARCHAR(64) NOT NULL,
    "source_risks_json" JSONB NOT NULL,
    "response_json" JSONB NOT NULL,
    "created_by_email" VARCHAR(255),
    "updated_by_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_analysis_overall_missing_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_analysis_overall_missing_company_unit_idx" ON "risk_analysis_overall_missing_risks"("company_identifier", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_overall_missing_company_unit_business_key" ON "risk_analysis_overall_missing_risks"("company_identifier", "unit_id", "business_process");
