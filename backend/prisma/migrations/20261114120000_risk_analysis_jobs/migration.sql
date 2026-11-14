CREATE TABLE "risk_analysis_jobs" (
    "id" UUID NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "requested_by_email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_analysis_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "risk_analysis_jobs_pending_idx" ON "risk_analysis_jobs"("status", "created_at");
CREATE INDEX "risk_analysis_jobs_scope_idx" ON "risk_analysis_jobs"("company_identifier", "unit_id", "created_at");
