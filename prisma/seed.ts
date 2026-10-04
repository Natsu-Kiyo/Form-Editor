/**
 * 演示数据种子脚本。
 *
 * M0 阶段仅建立入口；M1 起逐步补齐：
 * - 演示账号（demo@qingwj.cn / viewer@qingwj.cn）
 * - 工作区与成员关系
 * - 官方模板 8 张（覆盖 5 个分类）
 * - 演示问卷三态：回收中（128/200）、已截止、草稿
 */
async function main() {
  console.log('[seed] 演示数据将在 M1 起补齐，当前骨架无写入。');
}

main().catch((error: unknown) => {
  console.error('[seed] 执行失败：', error);
  process.exit(1);
});
