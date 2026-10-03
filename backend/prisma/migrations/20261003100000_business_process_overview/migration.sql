/*
  Warnings:

  - A unique constraint covering the columns `[company_identifier,unit_id,business_process]` on the table `risk_analysis_business_process_overviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unit_id` to the `risk_analysis_business_process_overviews` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "risk_analysis_bp_overviews_company_business_key";

-- DropIndex
DROP INDEX "risk_analysis_bp_overviews_company_idx";

-- AlterTable
ALTER TABLE "risk_analysis_business_process_overviews" ADD COLUMN     "unit_id" VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE INDEX "risk_analysis_bp_overviews_company_unit_idx" ON "risk_analysis_business_process_overviews"("company_identifier", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_analysis_bp_overviews_company_unit_business_key" ON "risk_analysis_business_process_overviews"("company_identifier", "unit_id", "business_process");
