/*
  Warnings:

  - You are about to drop the column `inviteTemplate` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "inviteTemplate" TEXT,
ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "officeRoom" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "inviteTemplate";
