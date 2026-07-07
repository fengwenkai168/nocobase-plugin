/**
 * 取消标志管理（内存 Set + DB 字段双重驱动）
 *
 * 工作原理：
 * 1. 用户取消任务时，tasks.ts 会更新 DB 中的 status 为 'cancelled'
 * 2. 任务执行过程中，通过 cancelFlags（内存 Set）快速检查取消状态，避免频繁查询 DB
 * 3. import-service.ts 在任务完成/失败时清理 cancelFlags
 *
 * 这种混合方式兼顾了：
 * - 持久性：DB 字段确保进程重启后仍能恢复取消状态
 * - 性能：内存 Set 提供 O(1) 的快速检查
 */
export const cancelFlags: Set<number> = new Set();
