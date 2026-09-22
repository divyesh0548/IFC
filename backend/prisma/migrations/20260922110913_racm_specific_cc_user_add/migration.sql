/*
  Warnings:

  - A unique constraint covering the columns `[email_id,business_process,unit_id,racm_identifier]` on the table `racm_cc_users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "racm_cc_users_email_id_business_process_unit_id_key";

-- AlterTable
ALTER TABLE "racm_cc_users" ADD COLUMN     "racm_identifier" VARCHAR(255) NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "racm_cc_users_email_id_business_process_unit_id_racm_identi_key" ON "racm_cc_users"("email_id", "business_process", "unit_id", "racm_identifier");
