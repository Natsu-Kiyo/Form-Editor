-- 同一工作区不允许同名模板。
--
-- 「另存为模板」原本只在 action 里做了一次「查同名 → 通过就写」，
-- 两步之间是窗口：慢环境下同一个表单提交被重试两次就能写进两行
-- （E2E 实测撞上过：同名两行相差 13 秒）。
-- 官方模板的 workspaceId 为 NULL，Postgres 认为 NULL 彼此不同，
-- 所以那 8 张官方模板不受这条约束影响。
CREATE UNIQUE INDEX "Template_workspaceId_title_key" ON "Template"("workspaceId", "title");
