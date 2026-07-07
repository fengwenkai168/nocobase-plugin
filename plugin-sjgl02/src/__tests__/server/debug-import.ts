// 调试脚本：测试 processImportAsync 是否正确工作
import { setupTestApp, teardownTestApp, createTestCollections, saveTablePermission } from './helpers/setup';
import { cleanupBusinessData, cleanupTargetTable, cleanupShadowTables } from './helpers/cleanup';
import { createExcelFile, getFixturePath, cleanupFixture, createAttachment } from './helpers/fixtures';

async function main() {
  const ctx = await setupTestApp();
  await createTestCollections(ctx.app);

  await saveTablePermission(ctx.app, ctx.adminAgent, {
    targetType: 'role',
    targetId: ctx.normalRole.get('name'),
    targetName: ctx.normalRole.get('title'),
    tableName: 'posts',
    canImport: true,
    importMode: ['insert', 'update', 'upsert'],
  });

  const fixturePath = getFixturePath('import.xlsx');
  createExcelFile(
    fixturePath,
    'Sheet1',
    ['标题', '内容', '浏览量'],
    [
      ['第一篇文章', '内容1', 100],
      ['第二篇文章', '内容2', 200],
    ],
  );

  const fileId = await createAttachment(ctx.app, fixturePath, 'import.xlsx');

  console.log('=== 创建导入任务 ===');
  const res = await ctx.adminAgent.resource('sjgl02Import').execute({
    values: {
      tableName: 'posts',
      fileId,
      sheetName: 'Sheet1',
      headerRow: 1,
      fieldMapping: { title: '标题', content: '内容', views: '浏览量' },
      importMode: 'insert',
    },
  });

  console.log('Status:', res.status);
  const taskId = res.body.data.taskId;
  console.log('TaskId:', taskId);

  // 等待任务完成
  console.log('=== 等待完成 ===');
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const task = await ctx.app.db.getRepository('sjgl02_tasks').findOne({ filter: { id: taskId } });
    const status = task.get('status');
    console.log(`  ${(i + 1) * 2}s: status=${status}, error=${task.get('errorMessage') || ''}`);
    if (['completed', 'failed', 'cancelled'].includes(status)) break;
  }

  // 检查结果
  const task = await ctx.app.db.getRepository('sjgl02_tasks').findOne({ filter: { id: taskId } });
  console.log('=== 最终结果 ===');
  console.log('status:', task.get('status'));
  console.log('errorMessage:', task.get('errorMessage'));

  const posts = await ctx.app.db.getRepository('posts').find();
  console.log('posts count:', posts.length);
  posts.forEach((p) => console.log('  -', p.get('title'), p.get('content')));

  // 清理
  cleanupFixture(fixturePath);
  await cleanupShadowTables(ctx.app);
  await cleanupTargetTable(ctx.app, 'posts');
  await cleanupBusinessData(ctx.app);
  await teardownTestApp(ctx.app);
}

main().catch((e) => console.error(e));
