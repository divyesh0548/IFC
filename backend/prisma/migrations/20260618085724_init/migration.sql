-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255),
    "company_name" VARCHAR(255),
    "registered_email" VARCHAR(255),
    "registered_address" TEXT,
    "unique_identification_number" VARCHAR(255),
    "gst" VARCHAR(255),
    "pan" VARCHAR(255),
    "number_of_corporate_offices" VARCHAR(255),
    "number_of_factory_units" VARCHAR(255),
    "created_at" TIMESTAMP(6),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_unit_master" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255),
    "unit_name" VARCHAR(255),
    "unit_address" TEXT,
    "unit_id" VARCHAR(255),

    CONSTRAINT "company_unit_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_unit_memberships" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "user_email_id" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_unit_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordinator_unit_assignments" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "coordinator_email_id" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_unit_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approver_assignments" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "approver_email_id" VARCHAR(255) NOT NULL,
    "assignment_scope" VARCHAR(30) NOT NULL,
    "unit_id" VARCHAR(255),
    "business_process" VARCHAR(255),
    "form_id" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ifc_users" (
    "id" SERIAL NOT NULL,
    "email_id" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "temp_login" BOOLEAN DEFAULT false,
    "company_identifier" VARCHAR(255),
    "emp_code" VARCHAR(255),
    "emp_name" VARCHAR(255),
    "designation" VARCHAR(255),
    "department" VARCHAR(255),
    "mobile" VARCHAR(255),
    "login_email_sent" BOOLEAN DEFAULT false,
    "temp_password_encrypted" TEXT,

    CONSTRAINT "ifc_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_forms" (
    "id" SERIAL NOT NULL,
    "standard_control_description" TEXT,
    "sub_process" VARCHAR(255),
    "risk_description" TEXT,
    "whether_fraud_risks_exist" VARCHAR(255),
    "control_objective" TEXT,
    "ipe_reference" TEXT,
    "nature_of_control" VARCHAR(255),
    "control_frequency" VARCHAR(255),
    "active" BOOLEAN DEFAULT false,
    "status" VARCHAR(255),
    "reason_by_approver" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6),
    "company_identifier" VARCHAR(255),
    "form_id" VARCHAR(255),
    "unit_id" VARCHAR(255),
    "remarks_by_user" TEXT,
    "business_process" VARCHAR(255),
    "financial_year" VARCHAR(255),
    "sample_required" TEXT,
    "completeness" BOOLEAN,
    "existence_occurrence" BOOLEAN,
    "rights_and_obligation" BOOLEAN,
    "valuation_and_allocation" BOOLEAN,
    "presentation_and_disclosure" BOOLEAN,
    "control_number" VARCHAR(255),
    "area" TEXT,
    "risk_heat" VARCHAR(255),
    "process_walkthrough" TEXT,
    "control_relies_on_ipe" VARCHAR(255),
    "audit_evidence_accuracy" VARCHAR(255),
    "key_control" VARCHAR(255),
    "application_name" VARCHAR(255),
    "control_performer" TEXT,
    "control_owner" TEXT,
    "control_design_procs" TEXT,
    "control_design_conclusion" VARCHAR(255),
    "design_deficiency_desc" VARCHAR(255),
    "sample_size" VARCHAR(255),
    "control_type_fo" VARCHAR(255),
    "control_type_ma" VARCHAR(255),
    "due_date" DATE,
    "reminder_frequency" VARCHAR(50),
    "sent_for_approval_timestamp" TIMESTAMP(6),
    "approval_status_change_timestamp" TIMESTAMP(6),
    "pending_changes" BOOLEAN DEFAULT false,
    "user_mail_sent" BOOLEAN DEFAULT false,
    "inactive_mail_pending" BOOLEAN DEFAULT false,
    "deficiency_action_status" BOOLEAN DEFAULT false,
    "deficiency_response_status" VARCHAR(50),
    "deficiency_case_id" VARCHAR(30),

    CONSTRAINT "control_forms_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "risk_analysis" (
    "id" BIGSERIAL NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255),
    "sub_process" VARCHAR(255),
    "model_name" VARCHAR(255) NOT NULL,
    "matched_sub_process" VARCHAR(255),
    "match_confidence" VARCHAR(50),
    "coverage_status" VARCHAR(50),
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "risk_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request" (
    "id" BIGSERIAL NOT NULL,
    "request_id" VARCHAR(30) NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255),
    "requested_by_email" VARCHAR(255) NOT NULL,
    "requested_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "status" VARCHAR(50) NOT NULL,
    "reviewed_by_email" VARCHAR(255),
    "request_reason" TEXT,
    "reviewer_comment" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_request_item" (
    "id" BIGSERIAL NOT NULL,
    "change_request_id" BIGINT NOT NULL,
    "field_db_name" VARCHAR(100) NOT NULL,
    "field_label" VARCHAR(255),
    "old_value_text" TEXT,
    "new_value_text" TEXT,
    "status" VARCHAR(50) NOT NULL,
    "rejection_reason" TEXT,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "change_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_form_history" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "reason_by_approver" TEXT,
    "rejection_timestamp" TIMESTAMP(6),

    CONSTRAINT "control_form_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deficiency_response" (
    "id" SERIAL NOT NULL,
    "response_id" VARCHAR(30) NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "company_identifier" VARCHAR(255),
    "unit_id" VARCHAR(255),
    "response_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submitted_by_email" VARCHAR(255),
    "submitted_at" TIMESTAMP(6),
    "reviewed_by_email" VARCHAR(255),
    "reviewed_at" TIMESTAMP(6),
    "review_decision" VARCHAR(50),
    "review_comment" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "explaination" TEXT,
    "due_date" DATE,
    "concerned_person" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
    "updated_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "deficiency_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deficiency_response_submission" (
    "id" SERIAL NOT NULL,
    "deficiency_response_id" INTEGER NOT NULL,
    "version_no" INTEGER NOT NULL,
    "submission_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submitted_by_email" VARCHAR(255),
    "submitted_at" TIMESTAMP(6),
    "reviewed_by_email" VARCHAR(255),
    "reviewed_at" TIMESTAMP(6),
    "review_decision" VARCHAR(50),
    "review_comment" TEXT,
    "explaination" TEXT,
    "due_date" DATE,
    "concerned_person" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "deficiency_response_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deficiency_response_attachment" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "file_url" VARCHAR(1024) NOT NULL,
    "original_name" VARCHAR(255),
    "uploaded_by_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),

    CONSTRAINT "deficiency_response_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_docs" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "sample_doc" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_uploaded_by_user" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255),
    "doc_uploaded_by_user" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_uploaded_by_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_process_master" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255),
    "business_process" VARCHAR(255) NOT NULL,
    "business_process_code" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_email" VARCHAR(255),
    "updated_by_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_process_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racm_cc_users" (
    "id" SERIAL NOT NULL,
    "email_id" VARCHAR(255) NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "racm_cc_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(255),
    "user_email_id" VARCHAR(255),
    "ref_data" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs_racm" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(255),
    "user_email_id" VARCHAR(255),
    "form_id" VARCHAR(255),
    "ref_data" TEXT,

    CONSTRAINT "audit_logs_racm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_identifier_key" ON "companies"("company_identifier");

-- CreateIndex
CREATE UNIQUE INDEX "company_unit_master_company_identifier_unit_id_key" ON "company_unit_master"("company_identifier", "unit_id");

-- CreateIndex
CREATE INDEX "user_unit_memberships_company_identifier_unit_id_idx" ON "user_unit_memberships"("company_identifier", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_unit_memberships_company_identifier_user_email_id_unit_key" ON "user_unit_memberships"("company_identifier", "user_email_id", "unit_id");

-- CreateIndex
CREATE INDEX "coordinator_unit_assignments_company_identifier_unit_id_idx" ON "coordinator_unit_assignments"("company_identifier", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "coordinator_unit_assignments_company_identifier_coordinator_key" ON "coordinator_unit_assignments"("company_identifier", "coordinator_email_id", "unit_id");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_approver_email_id_idx" ON "approver_assignments"("company_identifier", "approver_email_id");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_unit_id_idx" ON "approver_assignments"("company_identifier", "unit_id");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_business_process_idx" ON "approver_assignments"("company_identifier", "business_process");

-- CreateIndex
CREATE INDEX "approver_assignments_company_identifier_form_id_idx" ON "approver_assignments"("company_identifier", "form_id");

-- CreateIndex
CREATE UNIQUE INDEX "ifc_users_email_id_key" ON "ifc_users"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "control_forms_form_id_key" ON "control_forms"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "control_forms_company_identifier_control_number_key" ON "control_forms"("company_identifier", "control_number");

-- CreateIndex
CREATE UNIQUE INDEX "controls_reminder_form_id_key" ON "controls_reminder"("form_id");

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_run_table_company_identifier_idx" ON "key_manual_ai_insights_run_table"("company_identifier");

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_row_data_run_id_idx" ON "key_manual_ai_insights_row_data"("run_id");

-- CreateIndex
CREATE INDEX "key_manual_ai_insights_row_data_company_identifier_business_idx" ON "key_manual_ai_insights_row_data"("company_identifier", "business_process");

-- CreateIndex
CREATE UNIQUE INDEX "key_manual_ai_insights_row_data_company_identifier_run_id_c_key" ON "key_manual_ai_insights_row_data"("company_identifier", "run_id", "control_number");

-- CreateIndex
CREATE INDEX "risk_analysis_company_identifier_business_process_idx" ON "risk_analysis"("company_identifier", "business_process");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_company_identifier_form_id_key" ON "risk_analysis"("company_identifier", "form_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_request_request_id_key" ON "change_request"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_request_item_change_request_id_field_db_name_key" ON "change_request_item"("change_request_id", "field_db_name");

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_response_id_key" ON "deficiency_response"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_form_id_key" ON "deficiency_response"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_submission_deficiency_response_id_versi_key" ON "deficiency_response_submission"("deficiency_response_id", "version_no");

-- CreateIndex
CREATE INDEX "business_process_master_company_identifier_is_active_idx" ON "business_process_master"("company_identifier", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "racm_cc_users_email_id_business_process_unit_id_key" ON "racm_cc_users"("email_id", "business_process", "unit_id");

-- AddForeignKey
ALTER TABLE "company_unit_master" ADD CONSTRAINT "company_unit_master_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_memberships" ADD CONSTRAINT "user_unit_memberships_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unit_memberships" ADD CONSTRAINT "user_unit_memberships_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_unit_assignments" ADD CONSTRAINT "coordinator_unit_assignments_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coordinator_unit_assignments" ADD CONSTRAINT "coordinator_unit_assignments_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approver_assignments" ADD CONSTRAINT "approver_assignments_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifc_users" ADD CONSTRAINT "ifc_users_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_company_identifier_unit_id_fkey" FOREIGN KEY ("company_identifier", "unit_id") REFERENCES "company_unit_master"("company_identifier", "unit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controls_reminder" ADD CONSTRAINT "controls_reminder_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_manual_ai_insights_row_data" ADD CONSTRAINT "key_manual_ai_insights_row_data_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "key_manual_ai_insights_run_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_item" ADD CONSTRAINT "change_request_item_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_form_history" ADD CONSTRAINT "control_form_history_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiency_response" ADD CONSTRAINT "deficiency_response_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiency_response_submission" ADD CONSTRAINT "deficiency_response_submission_deficiency_response_id_fkey" FOREIGN KEY ("deficiency_response_id") REFERENCES "deficiency_response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiency_response_attachment" ADD CONSTRAINT "deficiency_response_attachment_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "deficiency_response_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_docs" ADD CONSTRAINT "sample_docs_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_uploaded_by_user" ADD CONSTRAINT "doc_uploaded_by_user_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_process_master" ADD CONSTRAINT "business_process_master_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_email_id_fkey" FOREIGN KEY ("user_email_id") REFERENCES "ifc_users"("email_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs_racm" ADD CONSTRAINT "audit_logs_racm_user_email_id_fkey" FOREIGN KEY ("user_email_id") REFERENCES "ifc_users"("email_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs_racm" ADD CONSTRAINT "audit_logs_racm_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;
