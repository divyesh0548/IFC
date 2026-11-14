/*
  Warnings:

  - A unique constraint covering the columns `[unique_identification_number]` on the table `companies` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "companies_unique_identification_number_key" ON "companies"("unique_identification_number");
