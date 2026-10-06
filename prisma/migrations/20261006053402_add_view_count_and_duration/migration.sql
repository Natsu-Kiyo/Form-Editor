-- AlterTable
ALTER TABLE "Questionnaire" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "durationMs" INTEGER;
