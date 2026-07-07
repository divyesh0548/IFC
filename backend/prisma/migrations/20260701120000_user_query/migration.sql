-- CreateTable
CREATE TABLE "user_query" (
    "id" SERIAL NOT NULL,
    "type_of_query" VARCHAR(255) NOT NULL,
    "explanation" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "submitted_on" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_on" TIMESTAMP(6),
    "mail_sent_to_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_query_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_query_submitted_on_idx" ON "user_query"("submitted_on");

-- CreateIndex
CREATE INDEX "user_query_reviewed_idx" ON "user_query"("reviewed");

-- CreateIndex
CREATE INDEX "user_query_mail_sent_to_admin_idx" ON "user_query"("mail_sent_to_admin");

-- AddForeignKey
ALTER TABLE "user_query" ADD CONSTRAINT "user_query_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ifc_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
