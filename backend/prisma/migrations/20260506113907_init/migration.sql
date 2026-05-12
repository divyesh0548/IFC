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
    "coordinator_email_id" VARCHAR(255),
    "approver_email_id" VARCHAR(255),

    CONSTRAINT "company_unit_master_pkey" PRIMARY KEY ("id")
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
    "unit_id" VARCHAR(255),
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
    "reminder_datetime" TIMESTAMP(6),
    "approval_status_change_timestamp" TIMESTAMP(6),
    "user_mail_sent" BOOLEAN DEFAULT false,

    CONSTRAINT "control_forms_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "businees_process_code" (
    "id" SERIAL NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "business_process_code" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "businees_process_code_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "company_unit_master_unit_id_key" ON "company_unit_master"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "ifc_users_email_id_key" ON "ifc_users"("email_id");

-- CreateIndex
CREATE UNIQUE INDEX "control_forms_form_id_key" ON "control_forms"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "control_forms_company_identifier_control_number_key" ON "control_forms"("company_identifier", "control_number");

-- CreateIndex
CREATE UNIQUE INDEX "businees_process_code_business_process_code_key" ON "businees_process_code"("business_process_code");

-- CreateIndex
CREATE UNIQUE INDEX "racm_cc_users_email_id_business_process_unit_id_key" ON "racm_cc_users"("email_id", "business_process", "unit_id");

-- AddForeignKey
ALTER TABLE "company_unit_master" ADD CONSTRAINT "company_unit_master_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ifc_users" ADD CONSTRAINT "ifc_users_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_company_identifier_fkey" FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_forms" ADD CONSTRAINT "control_forms_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_unit_master"("unit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_docs" ADD CONSTRAINT "sample_docs_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_uploaded_by_user" ADD CONSTRAINT "doc_uploaded_by_user_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_email_id_fkey" FOREIGN KEY ("user_email_id") REFERENCES "ifc_users"("email_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs_racm" ADD CONSTRAINT "audit_logs_racm_user_email_id_fkey" FOREIGN KEY ("user_email_id") REFERENCES "ifc_users"("email_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs_racm" ADD CONSTRAINT "audit_logs_racm_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE SET NULL ON UPDATE CASCADE;
