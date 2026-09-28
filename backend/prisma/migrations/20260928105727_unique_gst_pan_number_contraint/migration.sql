/*
  Warnings:

  - A unique constraint covering the columns `[gst]` on the table `companies` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pan]` on the table `companies` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "companies_gst_key" ON "companies"("gst");

-- CreateIndex
CREATE UNIQUE INDEX "companies_pan_key" ON "companies"("pan");
