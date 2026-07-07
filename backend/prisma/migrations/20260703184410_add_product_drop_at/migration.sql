-- AlterTable
ALTER TABLE "products" ADD COLUMN     "drop_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_drop_at_idx" ON "products"("drop_at");
