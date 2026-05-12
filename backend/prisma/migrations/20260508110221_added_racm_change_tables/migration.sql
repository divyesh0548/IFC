-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "businees_process_code" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "control_forms" ADD COLUMN     "pending_changes" BOOLEAN DEFAULT false,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "doc_uploaded_by_user" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sample_docs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "change_request" (
    "id" BIGSERIAL NOT NULL,
    "request_id" VARCHAR(30) NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "company_identifier" VARCHAR(255) NOT NULL,
    "unit_id" VARCHAR(255),
    "requested_by_email" VARCHAR(255) NOT NULL,
    "requested_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(50) NOT NULL,
    "reviewed_by_email" VARCHAR(255),
    "request_reason" TEXT,
    "reviewer_comment" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "change_request_request_id_key" ON "change_request"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_request_item_change_request_id_field_db_name_key" ON "change_request_item"("change_request_id", "field_db_name");

-- AddForeignKey
ALTER TABLE "change_request" ADD CONSTRAINT "change_request_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_request_item" ADD CONSTRAINT "change_request_item_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
