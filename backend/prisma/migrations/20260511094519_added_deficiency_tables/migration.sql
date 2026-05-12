/*
  Warnings:

  - You are about to drop the `compensatory_racm` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mitigation_plan` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "compensatory_racm" DROP CONSTRAINT "compensatory_racm_form_id_fkey";

-- DropForeignKey
ALTER TABLE "mitigation_plan" DROP CONSTRAINT "mitigation_plan_form_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "businees_process_code" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "change_request" ALTER COLUMN "requested_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text);

-- AlterTable
ALTER TABLE "change_request_item" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text),
ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text);

-- AlterTable
ALTER TABLE "control_forms" ADD COLUMN     "deficiency_action_status" BOOLEAN DEFAULT false,
ADD COLUMN     "deficiency_case_id" VARCHAR(30),
ADD COLUMN     "deficiency_response_status" VARCHAR(50),
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "doc_uploaded_by_user" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "compensatory_racm";

-- DropTable
DROP TABLE "mitigation_plan";

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

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_response_id_key" ON "deficiency_response"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_form_id_key" ON "deficiency_response"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "deficiency_response_submission_deficiency_response_id_versi_key" ON "deficiency_response_submission"("deficiency_response_id", "version_no");

-- AddForeignKey
ALTER TABLE "deficiency_response" ADD CONSTRAINT "deficiency_response_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiency_response_submission" ADD CONSTRAINT "deficiency_response_submission_deficiency_response_id_fkey" FOREIGN KEY ("deficiency_response_id") REFERENCES "deficiency_response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiency_response_attachment" ADD CONSTRAINT "deficiency_response_attachment_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "deficiency_response_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
