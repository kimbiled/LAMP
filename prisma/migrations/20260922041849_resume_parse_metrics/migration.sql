-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "experienceMonths" INTEGER;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "parseScore" INTEGER,
ADD COLUMN     "textSource" TEXT;
