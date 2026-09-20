-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "phoneKey" TEXT;

-- CreateIndex
CREATE INDEX "Candidate_companyId_phoneKey_idx" ON "Candidate"("companyId", "phoneKey");

-- Заполняем ключ у карточек, заведённых раньше: берём последние
-- десять цифр телефона, отбросив плюсы, скобки и пробелы.
UPDATE "Candidate"
SET "phoneKey" = RIGHT(REGEXP_REPLACE("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND LENGTH(REGEXP_REPLACE("phone", '\D', '', 'g')) >= 10;
