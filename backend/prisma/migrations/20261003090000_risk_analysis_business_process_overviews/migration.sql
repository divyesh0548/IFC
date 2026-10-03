-- CreateTable
CREATE TABLE "risk_analysis_business_process_overviews" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "overview_text" TEXT NOT NULL,
    "created_by_email" VARCHAR(255),
    "updated_by_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_analysis_business_process_overviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_analysis_bp_overviews_company_idx" ON "risk_analysis_business_process_overviews"("company_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_bp_overviews_company_business_key" ON "risk_analysis_business_process_overviews"("company_identifier", "business_process");
