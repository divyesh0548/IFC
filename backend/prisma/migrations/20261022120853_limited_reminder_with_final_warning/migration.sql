-- AlterTable
ALTER TABLE "controls_reminder" ADD COLUMN     "final_reminder_sent_at" TIMESTAMP(6),
ADD COLUMN     "reminder_sent_count" INTEGER NOT NULL DEFAULT 0;
