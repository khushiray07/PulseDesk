CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "Status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "customer_email" VARCHAR(255) NOT NULL,
  "priority" "Priority" NOT NULL,
  "status" "Status" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tickets_title_not_blank" CHECK (length(trim("title")) > 0),
  CONSTRAINT "tickets_description_not_blank" CHECK (length(trim("description")) > 0)
);

CREATE INDEX "tickets_created_at_id_idx" ON "tickets"("created_at", "id");
