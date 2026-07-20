-- CreateTable
CREATE TABLE "process_owner_declaration" (
    "id" SERIAL NOT NULL,
    "form_id" VARCHAR(255) NOT NULL,
    "no_furthure_submission" BOOLEAN DEFAULT false,
    "owner_comment" TEXT,
    "process_owner_email" VARCHAR(255),
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_owner_declaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "process_owner_declaration_form_id_key" ON "process_owner_declaration"("form_id");

-- AddForeignKey
ALTER TABLE "process_owner_declaration" ADD CONSTRAINT "process_owner_declaration_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "control_forms"("form_id") ON DELETE CASCADE ON UPDATE CASCADE;
