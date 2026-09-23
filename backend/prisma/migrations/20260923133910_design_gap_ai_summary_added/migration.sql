-- CreateTable
CREATE TABLE "design_gap_insights" (
    "id" BIGSERIAL NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255),
    "business_process" VARCHAR(255),
    "financial_year" VARCHAR(255),
    "control_number" VARCHAR(255),
    "control_design_status" VARCHAR(50) NOT NULL,
    "summary" TEXT NOT NULL,
    "results_json" JSONB NOT NULL,
    "ai_response_json" JSONB,
    "model_name" VARCHAR(255),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "run_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "design_gap_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "design_gap_insights_form_id_key" ON "design_gap_insights"("form_id");

-- CreateIndex
CREATE INDEX "design_gap_insights_company_identifier_unit_id_business_pro_idx" ON "design_gap_insights"("company_identifier", "unit_id", "business_process", "financial_year");

-- CreateIndex
CREATE INDEX "design_gap_insights_company_identifier_control_design_statu_idx" ON "design_gap_insights"("company_identifier", "control_design_status");

-- AddForeignKey
ALTER TABLE "design_gap_insights" ADD CONSTRAINT "design_gap_insights_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;
