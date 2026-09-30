/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `Candidate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "photoUrl",
ADD COLUMN     "photoKey" TEXT;
