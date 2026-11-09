-- CreateEnum
CREATE TYPE "InterviewFormat" AS ENUM ('ONLINE', 'OFFICE');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "format" "InterviewFormat";
