-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('DRAFT', 'SCHEDULED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "edition" TEXT,
ADD COLUMN     "hold_minutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "image_key" TEXT,
ADD COLUMN     "max_per_buyer" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "DropStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "products_created_by_id_idx" ON "products"("created_by_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
