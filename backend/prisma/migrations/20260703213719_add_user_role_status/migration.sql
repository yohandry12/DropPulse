-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CHASER', 'DROPPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CHASER',
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
