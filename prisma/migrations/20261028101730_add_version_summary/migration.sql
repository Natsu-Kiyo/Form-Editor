-- AlterTable
ALTER TABLE "QuestionnaireVersion" ADD COLUMN     "questionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceVersion" INTEGER;

-- 回填历史记录的题数：`snapshot` 与「导出 JSON」同构（payload.questions）。
-- 必须先判类型 —— `jsonb_array_length` 对非数组会直接报错，一条脏数据就会让整次迁移失败。
-- `sourceVersion` 刻意不回填：老记录的「回滚自 vN」与「上一条编号」语义并不相同，
-- 硬填会把它们显示成「修改自 v(n-1)」，那是编造。留空，界面回退显示原来的 `label`。
UPDATE "QuestionnaireVersion"
SET "questionCount" = jsonb_array_length("snapshot" -> 'payload' -> 'questions')
WHERE jsonb_typeof("snapshot" -> 'payload' -> 'questions') = 'array';
