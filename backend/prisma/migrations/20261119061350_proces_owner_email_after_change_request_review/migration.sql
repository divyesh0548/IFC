-- AlterTable
ALTER TABLE "change_request" ADD COLUMN     "requester_review_email_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requester_review_email_sent_at" TIMESTAMP(6);
