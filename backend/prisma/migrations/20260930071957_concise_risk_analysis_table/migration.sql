-- CreateTable
CREATE TABLE "risk_analysis_concise_lists" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "model_name" VARCHAR(255),
    "source_fingerprint" VARCHAR(64) NOT NULL,
    "source_control_numbers" JSONB NOT NULL,
    "risks_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_analysis_concise_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_analysis_concise_lists_company_identifier_unit_id_idx" ON "risk_analysis_concise_lists"("company_identifier", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_concise_lists_company_identifier_unit_id_busi_key" ON "risk_analysis_concise_lists"("company_identifier", "unit_id", "business_process");
