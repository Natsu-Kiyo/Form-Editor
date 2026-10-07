-- 访问口令改为**保存原文**（列名同步改成 accessPassword）。
--
-- 起因：发起人需要**再看到**自己设的口令 —— 那是要发给作答者的访问码，
-- 而只存哈希时忘掉就只能重设，重设会让已经发出去的那串码当场失效。
--
-- 为什么是「先删后加」而不是改名保留旧值：旧列里是 bcrypt 哈希，**无法还原成原文**，
-- 留着它既不能在设置页显示，也不能当口令比对，只会让人以为「口令还在」。
--
-- 后果（写在这里，免得日后被当成漏了数据迁移）：迁移前设过口令的问卷，会停在
-- `identityMode = 'PASSWORD'` 但 `accessPassword IS NULL` 的状态。公开页对这种状态
-- **不放行**（见 `public-questionnaire.ts` 的口令闸门），页面会显示「口令还没设置好」。
-- 也就是说它们会变成**暂时打不开**、而不是**悄悄敞开** —— 重设一次即可。
ALTER TABLE "Questionnaire" DROP COLUMN "accessPasswordHash";
ALTER TABLE "Questionnaire" ADD COLUMN "accessPassword" TEXT;
