-- CreateEnum
CREATE TYPE "SourceChannel" AS ENUM ('COLD', 'WARM', 'REFERRAL');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "sourceChannel" "SourceChannel";
