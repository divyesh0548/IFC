-- AlterTable
ALTER TABLE "change_request" ADD COLUMN     "coordinator_email_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coordinator_email_sent_at" TIMESTAMP(6);
