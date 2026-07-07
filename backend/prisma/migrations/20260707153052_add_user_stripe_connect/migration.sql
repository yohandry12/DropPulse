-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false;
