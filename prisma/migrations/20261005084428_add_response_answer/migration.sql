-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('VALID', 'INVALID');

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "channelId" TEXT,
    "respondentId" TEXT,
    "fingerprint" TEXT,
    "status" "ResponseStatus" NOT NULL DEFAULT 'VALID',
    "invalidReason" TEXT,
    "invalidatedById" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Response_questionnaireId_status_idx" ON "Response"("questionnaireId", "status");

-- CreateIndex
CREATE INDEX "Response_questionnaireId_submittedAt_idx" ON "Response"("questionnaireId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Response_questionnaireId_respondentId_key" ON "Response"("questionnaireId", "respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_questionnaireId_fingerprint_key" ON "Response"("questionnaireId", "fingerprint");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_responseId_questionId_key" ON "Answer"("responseId", "questionId");

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
