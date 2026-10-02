CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "avatar_url" VARCHAR(2048),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_name_not_blank" CHECK (length(trim("name")) > 0),
  CONSTRAINT "users_email_normalized" CHECK ("email" = lower(trim("email")) AND length("email") > 0)
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "ticket_assignees" (
  "ticket_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_assignees_pkey" PRIMARY KEY ("ticket_id", "user_id"),
  CONSTRAINT "ticket_assignees_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE,
  CONSTRAINT "ticket_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "ticket_assignees_user_id_idx" ON "ticket_assignees"("user_id");

CREATE TABLE "comments" (
  "id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "content" VARCHAR(5000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_content_not_blank" CHECK (length(trim("content")) > 0),
  CONSTRAINT "comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE,
  CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "comments_ticket_id_created_at_id_idx" ON "comments"("ticket_id", "created_at", "id");
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");
