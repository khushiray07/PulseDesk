ALTER TABLE "users" ADD COLUMN "google_subject" VARCHAR(255),
  ADD COLUMN "last_login_at" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

CREATE TABLE "sessions" (
  "sid" VARCHAR NOT NULL,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");
