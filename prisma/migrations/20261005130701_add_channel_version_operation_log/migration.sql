-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "srcToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireVersion" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_srcToken_key" ON "Channel"("srcToken");

-- CreateIndex
CREATE INDEX "Channel_questionnaireId_idx" ON "Channel"("questionnaireId");

-- CreateIndex
CREATE INDEX "QuestionnaireVersion_questionnaireId_version_idx" ON "QuestionnaireVersion"("questionnaireId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireVersion_questionnaireId_version_key" ON "QuestionnaireVersion"("questionnaireId", "version");

-- CreateIndex
CREATE INDEX "OperationLog_workspaceId_createdAt_idx" ON "OperationLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_targetType_targetId_idx" ON "OperationLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireVersion" ADD CONSTRAINT "QuestionnaireVersion_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireVersion" ADD CONSTRAINT "QuestionnaireVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
