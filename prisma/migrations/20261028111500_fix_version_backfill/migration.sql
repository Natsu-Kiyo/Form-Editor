-- 修正两个回填口径（20261028101730 那条把路路径写错了：`snapshot` 存的就是结构本身，
-- 不是 `{ payload: ... }` 包一层 —— 于是历史记录的 `questionCount` 全是 0）。

-- 1. 题数：`snapshot` 与「导出 JSON」同构，题目在顶层 `questions`。
--    先判类型再取长度：`jsonb_array_length` 对非数组会直接报错，一条脏数据就能让整次迁移失败。
UPDATE "QuestionnaireVersion"
SET "questionCount" = jsonb_array_length("snapshot" -> 'questions')
WHERE "questionCount" = 0
  AND jsonb_typeof("snapshot" -> 'questions') = 'array';

-- 兼容另一种可能的形状（早期若有人存成 `{ payload: ... }`）
UPDATE "QuestionnaireVersion"
SET "questionCount" = jsonb_array_length("snapshot" -> 'payload' -> 'questions')
WHERE "questionCount" = 0
  AND jsonb_typeof("snapshot" -> 'payload' -> 'questions') = 'array';

-- 2. 来源版本：老记录（字段上线前）没有这个值，列表因此只能显示「保存草稿」。
--    「保存草稿 / 发布」这类记录的来源就是**上一条**：那条迁移里每次写入都会留一条记录，
--    编号连续，内容也确实是在上一条基础上改的 —— 回填 `version - 1` 是准确的。
--    「回滚自 vN」**刻意不回填**：它显示原 label 更准确（这一次写入本身就是一次回滚，
--    来源是更早的某一版而不是上一条）；硬填「修改自 v(N-1)」等于编造。
UPDATE "QuestionnaireVersion"
SET "sourceVersion" = "version" - 1
WHERE "sourceVersion" IS NULL
  AND "version" > 1
  AND "label" NOT LIKE '回滚自%';
