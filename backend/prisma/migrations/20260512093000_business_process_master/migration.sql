CREATE TABLE "business_process_master" (
    "id" SERIAL NOT NULL,
    "company_identifier" VARCHAR(255),
    "business_process" VARCHAR(255) NOT NULL,
    "business_process_code" VARCHAR(100) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_email" VARCHAR(255),
    "updated_by_email" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_process_master_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_process_master_default_business_process_key"
ON "business_process_master"(LOWER(TRIM("business_process")))
WHERE "company_identifier" IS NULL;

CREATE UNIQUE INDEX "business_process_master_default_business_process_code_key"
ON "business_process_master"(LOWER(TRIM("business_process_code")))
WHERE "company_identifier" IS NULL;

CREATE UNIQUE INDEX "business_process_master_company_business_process_key"
ON "business_process_master"("company_identifier", LOWER(TRIM("business_process")))
WHERE "company_identifier" IS NOT NULL;

CREATE UNIQUE INDEX "business_process_master_company_business_process_code_key"
ON "business_process_master"("company_identifier", LOWER(TRIM("business_process_code")))
WHERE "company_identifier" IS NOT NULL;

CREATE INDEX "business_process_master_company_identifier_is_active_idx"
ON "business_process_master"("company_identifier", "is_active");

ALTER TABLE "business_process_master"
ADD CONSTRAINT "business_process_master_company_identifier_fkey"
FOREIGN KEY ("company_identifier") REFERENCES "companies"("company_identifier")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "business_process_master" (
    "company_identifier",
    "business_process",
    "business_process_code",
    "is_default",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    NULL,
    TRIM("business_process"),
    TRIM("business_process_code"),
    TRUE,
    TRUE,
    COALESCE("created_at", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "businees_process_code"
WHERE NULLIF(TRIM(COALESCE("business_process", '')), '') IS NOT NULL
  AND NULLIF(TRIM(COALESCE("business_process_code", '')), '') IS NOT NULL;

DROP TABLE "businees_process_code";
