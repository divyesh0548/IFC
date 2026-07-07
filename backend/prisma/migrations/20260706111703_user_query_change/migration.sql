/*
  Warnings:

  - You are about to drop the column `user_id` on the `user_query` table. All the data in the column will be lost.
  - Added the required column `user_email_id` to the `user_query` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "approver_assignments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs_racm" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_process_master" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "control_forms" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "coordinator_unit_assignments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ifc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_cc_users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "racm_templates" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_query" DROP COLUMN "user_id",
ADD COLUMN     "user_email_id" VARCHAR(255) NOT NULL,
ALTER COLUMN "submitted_on" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_unit_memberships" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
