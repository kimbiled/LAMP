-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "priority" "JobPriority" NOT NULL DEFAULT 'MEDIUM';
