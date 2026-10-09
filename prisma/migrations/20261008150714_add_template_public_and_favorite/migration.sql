-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TemplateFavorite" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateFavorite_workspaceId_createdAt_idx" ON "TemplateFavorite"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFavorite_templateId_workspaceId_key" ON "TemplateFavorite"("templateId", "workspaceId");

-- CreateIndex
CREATE INDEX "Template_isPublic_publishedAt_idx" ON "Template"("isPublic", "publishedAt");

-- AddForeignKey
ALTER TABLE "TemplateFavorite" ADD CONSTRAINT "TemplateFavorite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFavorite" ADD CONSTRAINT "TemplateFavorite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
