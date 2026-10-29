-- AlterTable
ALTER TABLE "process_owner_declaration" ADD COLUMN     "declaration_confirmed" BOOLEAN DEFAULT false,
ADD COLUMN     "declaration_type" VARCHAR(50);
