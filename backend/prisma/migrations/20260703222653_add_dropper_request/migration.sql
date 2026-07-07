-- CreateEnum
CREATE TYPE "DropperRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CONSUMED');

-- CreateTable
CREATE TABLE "dropper_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_note" TEXT NOT NULL,
    "status" "DropperRequestStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "dropper_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dropper_requests_user_id_key" ON "dropper_requests"("user_id");

-- CreateIndex
CREATE INDEX "dropper_requests_status_idx" ON "dropper_requests"("status");

-- AddForeignKey
ALTER TABLE "dropper_requests" ADD CONSTRAINT "dropper_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
