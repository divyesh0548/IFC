-- CreateTable
CREATE TABLE "controls_library" (
    "id" SERIAL NOT NULL,
    "business_process" VARCHAR(255) NOT NULL,
    "sub_process" VARCHAR(255),
    "risk_description" TEXT,
    "risk_heat" VARCHAR(255),
    "control_objective" TEXT,
    "standard_control_description" TEXT,
    "control_type_ma" VARCHAR(255),
    "control_type_fo" VARCHAR(255),
    "nature_of_control" VARCHAR(255),
    "process_walkthrough" TEXT,
    "key_control" VARCHAR(255),
    "application_name" VARCHAR(255),
    "audit_evidence_accuracy" VARCHAR(255),
    "whether_fraud_risks_exist" VARCHAR(255),
    "control_frequency" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "controls_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "controls_library_business_process_idx" ON "controls_library"("business_process");

-- CreateIndex
CREATE INDEX "controls_library_business_process_sub_process_idx" ON "controls_library"("business_process", "sub_process");
