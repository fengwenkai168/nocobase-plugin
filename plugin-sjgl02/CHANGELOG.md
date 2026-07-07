# CHANGELOG

## 1.0.155 (2026-07-07) — 导出卡死 + 导入 Sheet 识别修复

### Bug 1（P0 导出任务卡死）
- **修复**：`resolveAttachmentFromFile` 路径拼接 bug，Worker 发出的完整相对路径被二次拼接 `exports/` 前缀，导致 `fs.existsSync()` 返回 false，任务永久卡在「进行中」
- **修复**：`resolveAttachmentFromFile` 改为智能路径解析：绝对路径直接用、含 `/` 路径用相对路径、裸文件名拼接 `exports/`

### Bug 2（P0 导入无法识别 Sheet）
- **修复**：`streamProcessExcel` 增加 sheet 回退逻辑：指定 sheet 找不到时自动回退至首个 sheet
- **修复**：后端 `uploadParse` / `executeImport` 去掉硬编码 `'Sheet1'` 默认值
- **修复**：前端 `importReducer` 默认 `sheetName` 从 `'Sheet1'` 改为空字符串

### P2 防御措施
- **ACL 收紧**：移除 `sjgl02_tasks` 直接 CRUD 权限，杜绝通过 REST API 创建无效任务
- **启动清理**：新增 `tableName` 为空的 pending/processing 任务清理
- **调度器**：已有空 `tableName` 校验（调度时自动标记为 failed）

- **版本**：1.0.154 → 1.0.155

## 1.0.154 (2026-07-07) — ESLint 警告清零 + 代码质量收尾
- **质量**：`yarn eslint packages/plugins/@my-project/plugin-sjgl02/src` 达到 **0 errors, 0 warnings**
- **修复**：移除 `member-role-switch.test.ts` 与 `usePermissions.ts` 中的非空断言
- **重构**：`importActions.ts` 的 `loadPermissions` 改为 async/await，消除 promise 嵌套警告
- **重构**：`useImportPanel.ts` / `DataPreviewCard.tsx` 的 useEffect 依赖精确化，避免依赖整个 `state` / `task`
- **重构**：`RelationTablesCard.tsx` 的 `tables` 改用 `useMemo`
- **重构**：`worker-manager.ts` 的 error 回调改为 async/await，消除 callback 内 promise 警告
- **版本**：1.0.153 → 1.0.154

## 1.0.153 (2026-07-07) — client-v2 国际化全面补全
- **国际化**：将 client-v2 目录下所有面向用户的中文硬编码字符串迁移到 i18n `t()` 调用
- **新增**：中英文 locale 文件新增 179 个翻译键，当前共 303 个键
- **修复**：补充 `useTranslation` 缺失的组件（`TabRenderer`、`ImportPreviewCard`、`ExportPreviewCard`）
- **修复**：修正 Ant Design Table 列类型推断导致的 TypeScript 声明构建错误
- **修复**：`TaskList` 分页 `showTotal` 参数名遮蔽 `t` 翻译函数
- **版本**：1.0.152 → 1.0.153

## 1.0.146 (2026-07-07) — zombie-guard.ts 文件拆分重构
- **重构**：将 `zombie-guard.ts`（605行）拆分为 3 个文件，提升代码可维护性
- **新增**：`worker-utils.ts`（123行）— 工具函数（resolveTempDir、sanitizeSheetName、getScalarFieldNames、getRelationFieldNames、getFieldDisplayName、getCollDisplayName、detectPkStrategy、getAttachFieldNames、getFileIdFieldNames）
- **新增**：`worker-manager.ts`（278行）— 子进程管理（activeWorkers、getWorkerPath、killWorker、runExportInline、forkExportWorker）
- **修改**：`zombie-guard.ts`（221行）— 聚合导出 + 调度器（importTimers、schedulerInterval、runSchedule、startSerialScheduler、triggerScheduler、stopSerialScheduler）
- **影响文件**：`src/server/workers/zombie-guard.ts`、`src/server/workers/worker-utils.ts`、`src/server/workers/worker-manager.ts`
- **版本**：1.0.144 → 1.0.146

## 1.0.144 (2026-07-06) — 修复 __all__ 导出拆分 + Worker crash + 导入防御
- **修复**：全部数据表（`__all__`）导出改为拆成 N 个独立任务，每个任务对应一张真实表，绕过调度器找不到 collection 的问题
- **修复**：导出 Worker 改为直接使用 `sequelize` 连接 PG，避免 `Database` 基类在独立子进程环境初始化失败导致 `exit code 1`
- **增强**：Worker exit 时捕获 `stderr` 追加到 errorMessage
- **防御**：调度器处理导入任务时校验 `tableName` 和 `importFileId` 为空则标记失败
- **影响文件**：`src/server/actions/export.ts`、`src/server/workers/export-worker.ts`、`src/server/workers/zombie-guard.ts`
- **版本**：1.0.143 → 1.0.144

## 1.0.143 (2026-07-06) — 修复导入任务详情必填字段显示错误
- **修复**：`ImportConfigCard`（任务详情）的「必填字段」错误地从 `fieldMapping` 推导，改为读取任务记录中存储的真实 `requiredFields`（来自权限配置）
- **新增**：`sjgl02_tasks` 表新增 `requiredFields` JSON 列，导入创建任务时存储权限配置的必填字段
- **新增**：`FieldMappingCard` 字段映射标签列增加「⚠必填」标签（与「⭐唯一值」并列显示）
- **影响文件**：`src/server/collections/sjgl02_tasks.ts`、`src/server/actions/import.ts`、`src/client-v2/panels/task/TaskCards.tsx`
- **版本**：1.0.142 → 1.0.143

## 1.0.142 (2026-07-06) — 导出导入架构重构：进程隔离 + 串行队列 + 僵尸防御
- **重构**：导出改为 `child_process.fork` 子进程执行，OOM 只杀子进程不影响主系统
- **重构**：导入导出均改为串行队列模式（pending → processing 状态驱动），用户可随时提交任务自动排队
- **新增**：`src/server/workers/export-worker.ts` 子进程入口，使用 raw SQL 查询 + `useSharedStrings:false` 流式写 Excel，内存峰值 ~80MB
- **新增**：`src/server/workers/zombie-guard.ts` 通用僵尸监控 + 串行调度器
- **新增**：子进程 2 分钟心跳超时 + 30 分钟总超时自动 kill；导入 PG `statement_timeout` 5 分钟 + 30 分钟总超时
- **重构**：取消机制从内存 Map 改为 DB state 字段驱动，子进程每页检查
- **移除**：`exportMutex`、`cancelFlags`、`processExportAsync`（迁移到 worker）
- **影响文件**：`src/server/workers/*`、`src/server/actions/export.ts`、`src/server/actions/import.ts`、`src/server/actions/cancel-state.ts`、`src/server/actions/tasks.ts`、`src/server/plugin.ts`、`package.json`
- **版本**：1.0.141 → 1.0.142

## 1.0.141 (2026-07-06) — 修复全部数据表导出跳过中间表问题
- **修复**：`src/server/actions/export.ts` 中无标量字段的纯关联中间表（如 `rolesUsers`、`customRequestsRoles`、`workflowCategoryRelations`）被跳过，导致“全部数据表”导出数据不完整
- **新增**：`getRelationFields` 辅助函数，按优先级 `belongsTo` → `hasOne/hasMany/belongsToMany` 兜底导出关系字段
- **修复**：`package.json` 测试脚本改为 `APP_ENV_PATH=../../.env.test.local yarn --cwd ../.. test ...`，避免递归调用并正确加载 PostgreSQL 测试配置
- **影响文件**：`src/server/actions/export.ts`、`package.json`
- **版本**：1.0.140 → 1.0.141

## 1.0.140 (2026-07-06) — 修复全部数据表导出时 column "id" does not exist 错误
- **修复**：`src/server/actions/export.ts` 中导出分页逻辑硬编码 `id` 字段，导致无主键 `id` 或自定义主键表（如 `collections`、`fields`、`roles`、`aiConversations` 等）导出时报错
- **重构**：新增 `getSinglePrimaryKey` 与 `detectPkStrategy`，通过 Sequelize 模型的 `primaryKeyAttributes` 动态获取单字段主键名及类型
- **重构**：`int_auto` 游标分页、`uuid` IN 分批均改为使用实际主键字段名；复合主键/无约束主键表强制回退 `offset/limit` 分页
- **增强日志**：每张表导出前记录表名、主键字段、分页策略；失败时记录完整错误堆栈到 `errorMessage` 与任务日志
- **影响文件**：`src/server/actions/export.ts`
- **版本**：1.0.139 → 1.0.140

## 1.0.139 (2026-07-06) — 修复权限开关保存失效
- **修复**：权限管理编辑弹窗中「允许导入」「允许导出」开关未注册为 Form 字段，导致保存时 `canImport`/`canExport` 丢失，数据库默认 `false`，权限显示「不允许」
- **重构**：`canImport`/`canExport`/`importMode` 统一由 Ant Design Form 管理，使用 `Form.useWatch` 监听并驱动条件渲染
- **影响文件**：`src/client-v2/panels/PermissionPanel.tsx`
- **版本**：1.0.138 → 1.0.139

## 1.0.138 (2026-07-06) — 移除导出数据范围功能
- **移除**：`sjgl02_table_permissions` 与 `sjgl02_tasks` 表的 `exportFilter` 字段及对应 migration
- **移除**：服务端 `PermissionService.getExportScopes()`、`getExportScopes` action、`sjgl02Permissions:scopes` 接口与 ACL 配置
- **移除**：导出时应用权限 `exportFilter` 与用户自定义 `filter` 的逻辑，`previewCount` 与 `executeExport` 不再接受 `filter` 参数
- **移除**：导出面板第二步「数据范围」卡片、`SimpleFilterBuilder` 组件、权限编辑弹窗「数据范围」表单项、任务详情「数据范围」卡片
- **移除**：`useV2Collection` hook 及对应单元测试（仅用于数据范围集合加载）
- **移除**：数据范围相关 locale 键（Data range / Custom filter / Export filter / Scope readonly tip 等）
- **调整**：E2E 测试中普通用户导出用例不再验证数据范围，改为验证完整导出
- **影响文件**：`src/server/collections/*.ts`、`src/server/services/permission-service.ts`、`src/server/actions/permissions.ts`、`src/server/actions/export.ts`、`src/server/plugin.ts`、`src/server/migrations/20260706160000-remove-export-filter.ts`、`src/client-v2/panels/export-*/*`、`src/client-v2/panels/PermissionPanel.tsx`、`src/client-v2/panels/task/TaskCards.tsx`、`src/client-v2/panels/task/TaskDetail.tsx`、`src/client-v2/components/SimpleFilterBuilder.tsx`、`src/client-v2/hooks/useV2Collection.ts`、`src/client-v2/types/permission.ts`、`src/client-v2/hooks/usePermissions.ts`、`src/locale/*.json`、`src/client/__e2e__/*`
- **版本**：1.0.137 → 1.0.138

## 1.0.137 (2026-07-06) — 修复模块引用与空表导出边界
- **修复**：`useImportPanel.ts` / `useExportPanel.ts` 正确引用 `../shared.ts` 与 `../../utils/api`，解决 v1 `SjglBlock` 懒加载面板时「Cannot find module './shared'」渲染失败
- **修复**：`ExportStepConfig.tsx` 正确引用 `../../components/SimpleFilterBuilder`，解决导出第二步组件加载失败
- **修复**：`admin-import.test.ts` / `admin-export.test.ts` 改为断言 `data-testid`，适配重构后的分步面板 UI
- **修复**：服务端导出移除「无数据则跳过」逻辑，空表也生成仅含表头的 Excel 文件，满足边界测试
- **重构**：`export.ts` 中 `while (true)` 改为布尔标志循环，消除 `no-constant-condition` lint 警告；补充空 `catch` 注释
- **测试**：服务端 27/27、客户端 30/30、E2E 21/21 全部通过；单元测试使用独立数据库 `nocobase_test_unit`
- **影响文件**：`src/client-v2/panels/import-hooks/useImportPanel.ts`、`src/client-v2/panels/export-hooks/useExportPanel.ts`、`src/client-v2/panels/export-steps/ExportStepConfig.tsx`、`src/server/actions/export.ts`、`src/client/__e2e__/admin-import.test.ts`、`src/client/__e2e__/admin-export.test.ts`
- **版本**：1.0.136 → 1.0.137

## 1.0.136 (2026-07-06) — E2E member 测试 UI 驱动化与权限修复
- **重构**：普通用户 E2E 测试由 API 驱动改为 UI 驱动，覆盖导入模式/字段限制、导出字段/数据范围、任务隔离与取消
- **修复**：`data.setup.ts` 使用正确的 Page/Grid/Row/Col 嵌套 schema，并显式授权给 member 角色，解决页面空白问题
- **修复**：服务端 ACL 允许 loggedIn 角色访问 `sjgl02Permissions:tables/get/scopes`，保证普通用户面板能加载表列表
- **新增**：为 `ImportPanel`、`ExportPanel`、`TaskList`、`SjglBlock` 添加 `data-testid`，提升 E2E 稳定性
- **新增**：空表导出边界场景测试
- **影响文件**：`src/server/plugin.ts`、`src/client/__e2e__/data.setup.ts`、`src/client/__e2e__/helpers/sjgl02-helpers.ts`、`src/client/__e2e__/member-*.test.ts`、`src/client/components/SjglBlock.tsx`、`src/client-v2/panels/ImportPanel.tsx`、`src/client-v2/panels/ExportPanel.tsx`、`src/client-v2/panels/task/TaskList.tsx`
- **版本**：1.0.135 → 1.0.136

## 1.0.135 (2026-07-05) — E2E 测试体系 API 驱动化
- **重构**：E2E 测试改为 API 驱动，绕过 Alpine 下 Chromium/UI 选择器不稳定问题
- **新增**：管理员 E2E 覆盖导入三种模式（insert/update/upsert）、导出及文件内容验证、任务列表/详情/取消、权限新增/修改/审计日志
- **新增**：普通用户 E2E 覆盖导入模式/字段权限限制、导出字段/数据范围限制、任务隔离与取消
- **修复**：`test.ts` 自定义 API fixture 移除全局 `Content-Type`，避免 multipart 上传被误判为 JSON
- **修复**：`data.setup.ts` 同步 E2E 环境本地存储配置到 `storage/uploads-e2e`
- **修复**：`clearTasks` 与 `clearPermissions` 使用正确的下划线资源名（`sjgl02_tasks`、`sjgl02_table_permissions`）
- **影响文件**：`src/client/__e2e__/*`、`src/client/__e2e__/helpers/sjgl02-helpers.ts`、`src/client/__e2e__/test.ts`、`src/client/__e2e__/data.setup.ts`、`src/client/__e2e__/playwright.config.ts`
- **版本**：1.0.134 → 1.0.135
- **修复**：E2E 冒烟测试访问路径由 `/v2/admin/settings/sjgl02` 改为 `/admin/settings/sjgl02`，匹配 v1 设置页注册
- **修复**：E2E 设置页标题断言改为英文 `Data Management`，避免菜单项与页面标题同名导致严格模式冲突
- **修复**：E2E 权限管理测试改用 `div[style*="cursor: pointer"]` 选择用户列表项，并断言英文 `Add Permission` 按钮
- **影响文件**：`src/client/__e2e__/smoke.test.ts`
- **版本**：1.0.133 → 1.0.134

## 1.0.133 (2026-07-05) — 建立完整测试体系并修复导入解析稳定性
- **新增**：服务端测试集 27 个用例，覆盖权限服务、导入解析/执行/回滚、导出、任务管理、集成流程
- **新增**：客户端（v2）测试集 30 个用例，覆盖全部 hooks（权限、表/目标列表、字段、视图范围、集合）与 `useAPI` 工具
- **新增**：E2E 冒烟测试 `src/client/__e2e__/smoke.test.ts`，验证 v2 设置页加载与权限管理标签交互
- **修复**：`streamProcessExcel` 由 ExcelJS 流式 `WorkbookReader` 改为非流式 `Workbook`，解决全量测试时偶发 `Cannot read properties of undefined (reading 'sheets')` 错误
- **修复**：`PermissionService.mergePermissions([])` 现在正确返回无权限，避免空权限列表被误判为全权限
- **修复**：`savePermissions` 同时支持 `permissions[0].targetType/targetId` 与顶层 `params.targetType/targetId`，并更新已存在记录避免唯一索引冲突
- **修复**：`executeImport` 在未传 `importMode` 时先设置默认 `'insert'` 再做权限校验
- **修复**：导入附件路径解析统一使用 `resolveAttachmentFilePath()`，优先 `LOCAL_STORAGE_DEST`，兼容测试环境
- **修复**：影子表写入排除未映射系统字段，并为影子表系统字段 `DROP NOT NULL`，避免 NOT NULL 约束导致 INSERT 失败
- **影响文件**：`src/server/actions/import.ts`、`src/server/actions/permissions.ts`、`src/server/services/permission-service.ts`、`src/server/plugin.ts`、`src/client-v2/__tests__/**/*`、`src/client/__e2e__/smoke.test.ts`
- **版本**：1.0.132 → 1.0.133

## 1.0.132 (2026-07-04) — 修复导出数据范围与权限方案切换
- **修复**：导出面板请求 `sjgl02Permissions:scopes` 时由 POST `data` 改为 GET `params`，解决未传 `tableName` 导致 400/tableName is required 的问题
- **修复**：切换已配置权限方案时回显 `exportFilter`，空范围时不再误报「当前方案已限定导出范围」
- **优化**：管理员完整权限等未配置固定范围时，数据范围区域统一使用简化版 `SimpleFilterBuilder`，移除只读 JSON 展示
- **优化**：`SimpleFilterBuilder` 未填写值或切换「为空/不为空」操作符时不再生成 `$eq: null`，空条件不输出
- **修复**：切换方案下拉过滤后若当前选项不可用自动回退到管理员完整权限，避免方案与表不匹配
- **影响文件**：`src/client-v2/panels/ExportPanel.tsx`、`src/client-v2/components/SimpleFilterBuilder.tsx`、`src/client-v2/panels/shared.ts`
- **版本**：1.0.131 → 1.0.132

## 1.0.131 (2026-07-04) — 修复集合加载监听、用户添加权限按钮与数据范围自定义筛选
- **修复**：v2 导出页/权限管理页/任务详情页新增 `useV2Collection` hook，通过监听 `dataSource:loaded` 事件并主动触发 `ensureLoaded`，解决 `CollectionFilterPanel` 一直显示「加载数据表集合...」的问题
- **修复**：权限管理页用户区块「添加权限」按钮因 `isSystemManaged` 判断被隐藏，恢复为对所有非管理员/超级管理员目标均显示
- **新增**：`SimpleFilterBuilder` 简化筛选组件，在系统 `CollectionFilterPanel` 因 v1 runtime 无法加载业务集合时提供字段-操作符-值自定义筛选能力，确保导出数据范围和权限导出范围可配置
- **修复**：v1 页面「添加区块 → 其他 → 数据管理」区块空白，新增 `SjglBlock` 组件并注册到 v1 组件表
- **修复**：权限管理编辑弹窗中「允许导入」「允许导出」开关文字不显示的问题
- **影响文件**：`src/client-v2/hooks/useV2Collection.ts`、`src/client-v2/hooks/index.ts`、`src/client-v2/components/SimpleFilterBuilder.tsx`、`src/client-v2/panels/ExportPanel.tsx`、`src/client-v2/panels/PermissionPanel.tsx`、`src/client-v2/panels/task/TaskCards.tsx`、`src/client/components/SjglBlock.tsx`、`src/client/plugin.tsx`
- **版本**：1.0.130 → 1.0.131

## 1.0.130 (2026-07-04) — 修复 CollectionFilterPanel 集合加载与 v1 区块空白
- **修复**：v2 导出页/权限管理页/任务详情页使用 `observer` 监听集合加载，解决 `CollectionFilterPanel` 因集合未就绪而显示 JSON 或「请先选择数据表」的问题
- **修复**：v1 页面「添加区块 → 其他 → 数据管理」区块空白，新增 `SjglBlock` 组件并注册到 v1 组件表
- **修复**：权限管理编辑弹窗中「允许导入」「允许导出」开关文字不显示的问题
- **优化**：导出页/权限页界面分组与间距，固定范围面板增加只读视觉提示
- **影响文件**：`src/client-v2/panels/ExportPanel.tsx`、`src/client-v2/panels/PermissionPanel.tsx`、`src/client-v2/panels/task/TaskCards.tsx`、`src/client/components/SjglBlock.tsx`、`src/client/plugin.tsx`
- **版本**：1.0.129 → 1.0.130

## 1.0.129 (2026-07-04) — 导出数据范围（exportFilter）
- **新增**：权限管理中可为每张表配置导出数据范围，使用 NocoBase 系统 `CollectionFilterPanel` 组件
- **新增**：导出面板第二步增加「数据范围」卡片，支持只读展示固定范围或自定义筛选
- **新增**：权限方案下拉支持切换用户自身/角色方案，admin/root 额外支持切换其他用户/角色和管理员完整权限
- **新增**：服务端 `PermissionService.getExportScopes()` 与 `sjgl02Permissions:scopes` 接口，返回所有可用导出方案及数据范围
- **新增**：任务详情显示「数据范围」卡片，展示任务使用的权限方案和筛选条件
- **新增**：`sjgl02_tasks` 表新增 `permSource` JSON 字段，保存任务创建时使用的权限方案
- **变更**：导出时优先使用权限配置的 `exportFilter`；未配置时允许用户自定义筛选；全表导出不应用数据范围
- **变更**：`previewCount` 同步按权限范围计算预计行数
- **版本**：1.0.128 → 1.0.129

## 1.0.128 (2026-07-04) — 修复 insert/upsert-insert 创建人/更新人失效 + v1 添加区块入口
- **修复**：`insert` / `upsert-insert` 模式下，直接对 `createdById` / `updatedById` 赋值会被 NocoBase context 字段钩子覆盖，导致创建人/更新人仍为 NULL
- **重构**：`targetRepo.create()` 调用时注入 `context: { state: { currentUser: { id: userId } } }`，让 NocoBase 自动填充任务创建人
- **新增**：`repo.create` 后通过 `UPDATE ... FROM (VALUES ...)` 按影子表数据二次修正 `createdById` / `updatedById` / `createdAt` / `updatedAt`，确保用户显式映射的系统字段优先写入
- **修复**：v1 页面「添加区块 → 其他」中「数据管理」入口消失的问题；将 `schemaInitializerManager.addItem` 的 `Component` 从错误的 `SjglBlockInitializer` 改为正确的 `Sjgl02BlockInitializer`
- **影响**：未映射系统字段时自动写入任务创建人和当前时间；映射后按 Excel 值写入，符合「映射即写入，未映射即系统维护」规则

- **修复**：`insert` / `upsert-insert` 模式下，直接对 `createdById` / `updatedById` 赋值会被 NocoBase context 字段钩子覆盖，导致创建人/更新人仍为 NULL
- **重构**：`targetRepo.create()` 调用时注入 `context: { state: { currentUser: { id: userId } } }`，让 NocoBase 自动填充任务创建人
- **新增**：`repo.create` 后通过 `UPDATE ... FROM (VALUES ...)` 按影子表数据二次修正 `createdById` / `updatedById` / `createdAt` / `updatedAt`，确保用户显式映射的系统字段优先写入
- **影响**：未映射系统字段时自动写入任务创建人和当前时间；映射后按 Excel 值写入，符合「映射即写入，未映射即系统维护」规则

## 1.0.127 (2026-07-04) — 导入自动填充创建人/更新人
- **修复**：异步后台导入时 `createdById` / `updatedById` / `createdAt` / `updatedAt` 未生效的问题
- **新增**：`insert` / `upsert-insert` 模式下，若用户未映射系统字段，自动写入当前任务创建人作为 `createdById` / `updatedById`，当前时间作为 `createdAt` / `updatedAt`
- **修复**：`update` / `upsert-update` 模式下 `updatedById` 使用 `COALESCE` 导致无法覆盖旧值的问题，改为强制更新为当前任务创建人

## 1.0.126 (2026-07-04) — 导入主键全面适配 Snowflake/UUID/Nano ID
- **重构**：影子表去掉 `INCLUDING CONSTRAINTS`，不再复制真实表主键的 `NOT NULL` 约束
- **新增**：影子表增加自增列 `__import_row_id__` 作为主键，用于阶段三分批读取
- **重构**：阶段三改为按 `__import_row_id__` 键集分页，每批 5000 行流式处理
- **重构**：`insert` / `upsert-insert` 分支改走 `targetRepo.create()`，未映射主键由 NocoBase 应用层生成
- **新增**：支持 Snowflake ID (53-bit)、UUID、Nano ID、自增整数等全部 NocoBase 预置主键类型
- **新增**：允许用户在 Excel 中填写主键值；填写时阶段一检测 Excel 内部重复，阶段三检测与数据库已有记录冲突
- **修复**：移除 `applyPrimaryKeyDefaults` 对数据库默认值（`nextval`/`gen_random_uuid`）的硬性依赖
- **修复**：`update` / `upsert-update` 的 SET 子句排除主键列，避免误更新主键
- **变更**：`update` 模式改为分批 SQL UPDATE，进度实时刷新，避免一次性锁定大表
- **变更**：`upsert` 模式先分批 UPDATE 匹配行，再分批 CREATE 未匹配行
- **变更**：主键映射后单元格为空时，视为由系统生成（而非报错）

## 1.0.125 (2026-07-04) — 影子表主键自动生成 + 任务日志增强
- **重构**：影子表创建后动态识别主键列（支持单字段/组合主键）
- **新增**：复制真实表主键的自动生成规则到影子表（自增序列、UUID v4、UUID v7 等）
- **变更**：主键能自动生成时，Excel 未映射主键也可正常插入；不能自动生成时则要求 Excel 必须映射
- **修复**：新增/upsert 模式因影子表 `id` 无默认值导致 NOT NULL 失败的问题
- **修复**：任务详情失败明细行号显示逻辑，优先显示 Excel 原始行号
- **优化**：执行日志查看器支持长错误信息自动换行、区域加高、ERROR 级别高亮为红色

## 1.0.124 (2026-07-04) — 权限服务重构与导出权限方案切换
- **重构**：新增 `PermissionService` 统一封装权限查询、角色来源、权限合并逻辑
- **重构**：`permission-check.ts` / `permissions.ts` 全部改用 `PermissionService`，消除重复逻辑
- **修复**：统一从 `rolesUsers` 表获取用户角色，不再依赖不稳定的 `users.appends('roles')`
- **修复**：权限配置查询改用底层 SQL，绕过 NocoBase ACL 对自定义 action 内部查询的拦截
- **新增**：导出接口支持 `permSource` 参数，管理员可切换模拟权限方案执行导出
- **优化**：导入/导出面板的「权限方案」下拉框对普通用户默认不选中管理员方案，admin 默认选中完整权限

## 1.0.123 (2026-07-04) — 导入系统字段与主键动态化
- **重构**：移除硬编码系统字段排除列表（`id/createdAt/updatedAt/createdById/updatedById/createdBy/updatedBy`）
- **新增**：动态识别主键列名（兼容 `id`、自定义主键如 `order_code`）
- **变更**：导入时只要字段在 Excel 中映射了就写入；未映射的字段交给数据库/系统自动处理
- **变更**：更新模式自动维护 `updatedAt` 和 `updatedById`（字段存在时），若用户已映射则使用 Excel 值
- **修复**：创建人、创建时间、主键等字段在映射后仍被错误排除的问题
- **修复**：前端字段列表隐藏 `createdBy`/`updatedBy` 虚拟关联字段，仅保留实际外键 `createdById`/`updatedById`

## 1.0.122 (2026-07-04) — 架构统一与深度修复
- **重构**：公共面板统一至 `client-v2/panels/`，v1 仅保留插件注册壳，避免双套面板重复维护
- **修复（安全）**：导入流程中 `DROP TABLE IF EXISTS` 与标识符均使用 `quoteIdentifier()` 转义，消除 SQL 注入风险
- **修复（内存）**：导入阶段二改为流式批量写入，按列数动态计算 batch size，避免全量 Excel 数据进内存
- **修复（类型）**：导入字段按目标字段类型转换，空字符串对非字符串字段自动转 `null`
- **修复（权限）**：admin/root 模拟权限方案时优先按 `permSource` 校验；业务集合直接 REST 仅管理员可见
- **修复（权限）**：admin/root 角色及用户默认拥有所有数据表的全权限（导入/导出、全部导入模式），无记录时实时补齐
- **修复（任务）**：取消/删除任务和查看任务日志增加创建人归属校验，非 admin 只能操作自己的任务
- **修复（启动清理）**：影子表 LIKE 查询加 ESCAPE，DROP 表名使用双引号转义

## 1.0.119 (2026-07-04) — Phase 3 INSERT 走 NocoBase ORM
- **重构**：INSERT/UPSERT-INSERT 改用 `repo.create()`（NocoBase 自动生成 id + 系统字段）
- **删除**：临时序列逻辑（不再需要）
- **删除**：系统字段 COALESCE SQL（NocoBase 自动填）

## 1.0.118 (2026-07-04) — 权限前端修复（4 项）
- **修复**：v1 auto-save 空数组也发请求 + 加 targetType/targetId
- **修复**：v2 useViewScope 保存时传 userId
- **修复**：v2 useTablePermission 多角色 importMode 取并集
- **修复**：v2 PermissionTab useViewScope 传 selectedTarget

## 1.0.117 (2026-07-03) — 权限系统深度修复（6 项缺陷）
- **修复 #1**：删除最后一条权限不生效 → 空数组时也执行删除循环，前端始终发送 targetType/targetId
- **修复 #2**：保存权限无事务保护 → 加 `sequelize.transaction()` 包裹
- **修复 #3**：permSource 跳过 admin/root → 管理员判定移到 permSource 之前
- **修复 #4**：多角色仅合并 importMode → 全字段取并集/最宽松值
- **修复 #5**：autoSave 为空时不发请求 → 删除早期 return
- **修复 #6**：get 时重复补齐 admin 权限 → 去掉冗余逻辑（install 已有）

## 1.0.116 (2026-07-03) — 压缩包内部文件名修复
- **修复**：`__all__` tar.gz 内文件名改为可读表名（`renameSync` 后追加）
- **修复**：附件按表归类到子目录（`表名/附件字段/文件`）

## 1.0.115 (2026-07-03) — ZIP 全面迁移到 tar.gz
- **重构**：全部 `archiver('zip')` → `archiver('tar', { gzip: true })`，零外部依赖
- **删除**：`hasZipCmd` 检测 + `execSync('zip')` 分支，代码减 30 行
- **测试**：`__all__` 导出 504K 行 14.8MB tar.gz 通过

## 1.0.114 (2026-07-03) — 流式 archiver 替代增量 ZIP
- **重构**：`__all__` 循环前创建 archiver 流，每表生成即追加，不积压文件
- **修复**：`archive.file()` 异步读取问题 — 不提前 unlink 文件

## 1.0.113 (2026-07-03) — 导出进度分母修正
- **修复**：`totalRows` 使用预估总行数做分母，不再实时累加

## 1.0.112 (2026-07-03) — archiver 兜底 + hasZipCmd 检测
- **新增**：`hasZipCmd` 检测，无 zip 命令时回退 archiver 合并

## 1.0.111 (2026-07-03) — 增量 ZIP 容错 + 日志
- **修复**：增量 ZIP 失败静默吞异常 → 加错误日志 + `zipOk` 标志，失败时回退到 outputFiles 收集方式
- **修复**：rename 前 `fs.existsSync` 验证 ZIP 存在，防 ENOENT

## 1.0.110 (2026-07-03) — __all__ 导出增量 ZIP（磁盘峰值降低 5-10 倍）
- **重构**：全部数据表导出改为增量 ZIP — 每表生成 XLSX 后立即追加到 ZIP 并删原文件
- **效果**：磁盘峰值从 sum(所有表) 降为 max(单表)+ZIP，400 万行不再崩溃

## 1.0.109 (2026-07-03) — 进度显示优化 + 刷新间隔调整
- **优化**：任务状态列/详情摘要进度文字格式 — `36% · 50000行已导入 / 总100000行`
- **优化**：任务列表刷新间隔 10s → 15s

## 1.0.108 (2026-07-03) — 预览显示全部映射 + 系统字段智能填充
- **修复**：数据预览只显示 Excel 映射列 → 改为基于 fieldMapping 全量构建（含自定义值📝、忽略字段）
- **新增**：系统字段智能填充 — 映射了取 Excel 值，没映射自动填 NOW()/userId
- **新增**：主键智能处理 — 映射了取 Excel 值，没映射由数据库自动生成
- **新增**：id 无默认值时自动创建临时序列（解决 NOT NULL 约束）

## 1.0.107 (2026-07-03) — 主键无默认值适配
- **修复**：`id` 列无 `nextval` 默认值时创建临时序列 `_sjgl02_temp_{id}_id_seq`，解决 NOT NULL 约束
- **清理**：迁移完成后自动 DROP 临时序列

## 1.0.106 (2026-07-03) — 失败逐行定位 + 失败数据预览
- **新增**：方案 C — Phase 2 批次 INSERT 失败时拆分重试（5000→500→1），定位到具体行号
- **新增**：失败任务详情显示"失败数据预览"卡片，从 errorLogs.snapshot 解析出失败行原始数据表格
- **修复**：catch 块 errorLogs/snapshot 作用域问题 → 提升到函数顶层

## 1.0.105 (2026-07-03) — 自定义主键适配
- **修复**：硬编码 `c !== 'id'` 无法识别自定义主键名（如 `order_code`）→ 查 `information_schema.table_constraints` 动态获取 PRIMARY KEY 列名
- **兼容**：不管主键叫 `id`、`ID`、`order_code`、`user_no` 还是任何名字，全部自动识别并排除，INSERT 时不写入主键列

## 1.0.104 (2026-07-03) — headers 实时回调 + 预览修复
- **修复**：Phase 1 `isEmptyRow` headers 空数组误判 → `streamProcessExcel` 增加 `onHeader` 回调，表头读到立即赋值
- **修复**：uploadParse 预览数据全是 `{}` → 先收集 rawRows 流结束后重建
- **修复**：preview 同上
- **修复**：Sheet 列表写死一个 → 用 `exceljs.readFile` 读取全部 Sheet 名
- **修复**：Phase 2 同步用 `onHeader` 回调，不再依赖前一阶段结果

## 1.0.103 (2026-07-03) — UI 修复 + 导出优化
- **优化**：任务列表操作按钮改为胶囊按钮（📋 详情 / ⏹ 取消），宽度增至170
- **修复**：导入失败任务详情缺少失败明细卡片（兼容 errorMessage 兜底）
- **修复**：导入完成预览数据为空时完全隐藏卡片 → 改为显示摘要+兜底提示
- **重构**：`__all__` 最终合并用系统 `zip -0` 替代 archiver（C 原生，10x 快且省内存）
- **新增**：合并前后写进度日志、合并前 `SET statement_timeout = 0` 防 PG 超时

## 1.0.102 (2026-07-03) — 测试通过

**三阶段导入 10万行 × 3种ID类型 全部通过**

| # | 表 | 模式 | 唯一值 | 耗时 | 状态 |
|---|-----|------|--------|------|------|
| 1-3 | int/uuid/snowflake | insert | — | 15.5s | ✅ |
| 4 | int | update | field_str | 15.3s | ✅ |
| 5 | int | update | field_str+int | 15.5s | ✅ |
| 6 | int | upsert | field_str | 18.4s | ✅ |
| 7 | int | upsert | field_str+int | 18.3s | ✅ |
| 8 | int | upsert | field_str | null blank | 15.3s | ✅ |
| 9 | int | upsert | field_str | skip blank | 15.4s | ✅ |

**修复的 Bug：**
- Phase 2 `phase2Headers` 空数组误判 → 复用 `phase1Headers`
- `ALTER COLUMN id DROP DEFAULT` → 移除，Phase 2 非 id 列 INSERT
- UPSERT `ON CONFLICT` 缺 DB 约束 → 两步 SQL

**环境**：用户A(insert/3字段) + 测试角色(update+upsert/3字段)，三表已建权限

## 1.0.101 (2026-07-03)
- **新增**：任务摘要卡片显示"关联数据Sheet"状态和包含的关联表列表
- **新增**：导出面板步骤 1 增加权限方案切换（admin/root），可切换已配置的用户/角色方案预览字段过滤效果
- **UI**：方案下拉框与原导入面板一致（用户/角色/管理员完整权限三级）

## 1.0.100 (2026-07-03)
- **修复**：一对多/多对多/一对一关联字段导出为空 — `appendFields` 补全 hasMany/belongsToMany(非附件)/hasOne
- **新增**：数组型关联字段格式化 `名称(主键：ID)`，如 `张三(主键：42), 李四(主键：57)`

## 1.0.99 (2026-07-03)
- **修复**：`__all__` 大导出 + 附件时进程崩溃 — 每表附件 ZIP 延迟到最终合并，archiver 次数 N+1 → 1
- **内存优化**：全局 `allAttachFileEntries` 收集所有表附件，最终合并时一次性加入，消除内存堆叠

## 1.0.98 (2026-07-03)
- **新增**：导出的完成文件自动重命名为可读格式 `表名称(表标识)_日期.xlsx/.zip`，兼容 `__all__`（`全部数据表_日期.zip`）
- **策略**：临时文件保留 `sjgl02_export_` 前缀用于崩溃残留识别，完成时 `renameSync` 去前缀
- **防重名**：文件名冲突时自动追加 `_1`、`_2` 后缀

## 1.0.97 (2026-07-03)
- **修复**：`__all__` 大导出 archiver 最终合并卡死 — 压缩级别从 9 降为 0（XLSX 已压缩无需再压缩）
- **修复**：archiver 写流缺 error handler 导致流失败时 Promise 永久 pending
- **修复**：每表附件打包 archiver 失败时静默吞异常导致无效文件入 outputFiles 引发合并崩溃
- **优化**：附件打包 archiver 压缩级别 9→1，失败时跳过该表附件不中断整体导出

## 1.0.96 (2026-07-03)
- **"百万级导入/导出"重构 v4**：导入三阶段流式处理（预校验→影子表写入→原子迁移），导出游标分页+合并附件扫描
- **移除 xlsx 依赖**：统一使用 exceljs ^4.4.0，三个解析端点（uploadParse/preview/executeImport）全部使用 WorkbookReader 流式 API
- **新增影子表机制**：导入阶段二创建 `_sjgl02_import_{taskId}` 临时表隔离写入，阶段三 `BEGIN → INSERT INTO SELECT → DROP → COMMIT` 原子迁移
- **新增内存级取消**：`cancelFlags: Set<number>` 替代纯数据库状态取消，进程每 1000 行检查，取消时自动 DROP 影子表
- **新增启动清理**：插件 load 阶段自动清理残留任务（5 分钟窗口）、孤儿影子表、残留导出文件
- **导出分页优化**：自增 ID 表使用游标 `WHERE id > ? LIMIT 5000`，UUID 表预取 ID 数组 `WHERE id IN (...)`
- **导出附件合并**：主循环一次扫描同时写 Excel 和收集附件 ID，去除了第二次独立扫描
- **导出临时文件**：统一命名 `sjgl02_export_{taskId}_{timestamp}`，完成文件保留供下载，失败/取消自动删除
- **导入错误日志截断**：阶段一 errorLogs 上限 1000 条
- **保留全部现有导出功能**：关联数据 Sheet、`__all__` 全表导出、文件名模板、表头格式、多表 ZIP 打包、附件
- **性能预期**：百万行导入 ~10-15 分钟 (<200MB 内存)，百万行导出 ~5-8 分钟 (<200MB 内存)
- **文件变更**：新增 `cancel-state.ts`，重写 `import.ts` / `export.ts`，修改 `plugin.ts` / `tasks.ts`，其他文件不变

## 1.0.95 (2026-07-02)
- **重构**：导入/导出执行异步化 — 任务创建后立即返回 taskId，实际处理在后台异步执行，HTTP 请求不再阻塞等待
- **修复**：大文件导入/导出时提交按钮长时间转圈甚至超时失败的问题
- **重构**：`writeTaskLog` 参数从 `ctx` 改为 `db`，适配异步执行上下文
- **重构**：`__all__` 全表导出权限检查前置到同步阶段，异步执行无需 `ctx`

## 1.0.94 (2026-07-02)
- **优化**：导入权限方案下拉改为「切换已配置的方案」，仅显示对当前表有导入权限配置的用户/角色
- **修复**：`__all__` 导出任务详情数据预览 404 — 跳过特殊表名查询

## 1.0.93 (2026-07-02)
- **修复**：流式写入器 `worksheets` 为 undefined 导致 `.map()` 崩溃

## 1.0.92 (2026-07-02)
- **新增**：任务详情导入配置卡片显示空白单元格处理模式
- **新增**：任务详情导出摘要显示表头格式配置和是否包含附件
- **新增**：`sjgl02_tasks` 表新增 `blankCellMode` / `headerStyle` 字段

## 1.0.91 (2026-07-02)
- **修复**：`__all__` 导出崩溃 — `fieldNames`/`assocScalarFields` 为 undefined 时 `.map()` 报错
- **修复**：streaming 代码中变量遮蔽导致进度永远为 0

## 1.0.90 (2026-07-02)
- **修复**：v2 页面区块缺版本号显示

## 1.0.89 (2026-07-02)
- **重构**：导出改用 `stream.xlsx.WorkbookWriter` 流式写入 + 分页查询（去 20000 行硬限制）
- **重构**：导入改用批次循环（1000行/批）+ 批量查询 + `createMany` 批量写入
- **性能**：导出支持百万行级别，内存 ~200MB；导入 DB 往返减少 1000 倍

## 1.0.88 (2026-07-02)
- **新增**：admin/root 导入时模拟权限方案 — 字段映射界面新增下拉，可切换使用其他用户或角色的导入权限配置
- **重构**：`permission-check.ts` 新增 `permSource` 参数，支持指定用户/角色权限检查
- **优化**：切换方案后自动重载字段映射和导入模式限制

## 1.0.87 (2026-07-02)
- **新增**：导入空白单元格处理下拉（按Excel值更新 / 按NULL更新 / 跳过）
- **新增**：方案C — update/upsert 模式下任意行唯一值字段为空 → 整批回滚，全部不写
- **重构**：`makeRecord` 按 `blankCellMode` 三路分支处理空值

## 1.0.86 (2026-07-02)
- **修复**：导出关联字段（belongsTo/hasOne）单元格值显示 ID 而非人名 — 取值链改为 `nickname \|\| username \|\| name \|\| email \|\| id`

## 1.0.85 (2026-07-02)
- **新增**：导出表头格式三选一配置 — `字段名(字段标识)` / `字段名` / `字段标识`（Radio.Group 在高级选项区）
- **重构**：`getFieldDisplayName` 和 `getCollDisplayName` 新增 `style` 参数控制输出格式

## 1.0.84 (2026-07-02)
- **修复**：全插件 5 个文件、16 处 antd 静态调用改为 `App.useApp()` Hook（消除 Antd 5.x 弃用警告）
  - `ExportPanel.tsx`（3 处）、`TaskCards.tsx`（6 处）、`TaskList.tsx`（3 处）
  - `PermissionPanel.tsx`（4 处）、`PermissionTab.tsx`（4 处）

## 1.0.83 (2026-07-02)
- **修复**：导入唯一值字段空值导致匹配失败 — filter 构建排除空字符串（`record[uf] !== ''`）
- **修复**：ImportPanel Antd 5.x 弃用警告 — `message`/`Modal.confirm` 改用 `App.useApp()` Hook
- **修复**：导入确认弹窗 `onOk` 补充 `return` Promise，确保 loading 状态正确

## 1.0.82 (2026-07-02)
- **修复**：关联表导出详情三列修复 — Sheet名称显示实际 Excel Sheet 格式（`字段名-目标表名`），关联表显示目标表信息「表名称(表标识)」，数据量查询真实记录数
- **重构**：`assocFieldMap` 新增 `targetTable` 字段，`RelationTablesCard` 改为异步加载数据量

## 1.0.81 (2026-07-02)
- **修复**：关联表 Tab 显示「已导出该表全部字段」文字而非字段标签 — `getTableFields` API 新增 `target` 字段返回
- **修复**：控制台 `tableFields?tableName=createdBy` 404 报错 — 无 `target` 时跳过无效 API 调用

## 1.0.80 (2026-07-02)
- **新增**：关联表 Tab 展示该表的全部字段标签（`FieldTag`列表），与主表字段 Tab 样式统一
- **新增**：关联表 Tab 标签显示主表关联字段信息 `关联字段标题(关联字段名) → 表名称(表标识)`
- **重构**：`TaskDetail.tsx` 新增 `assocFieldTitles`（按表分组字段标题）和 `assocFieldMap`（关联字段信息）状态

## 1.0.79 (2026-07-02)
- **修复**：导出字段卡片仅显示「主表字段」Tab，关联表 Tab 缺失 — 改用 `associationSheetTables` 作为关联表数据源
- **重构**：`TaskDetail.tsx` 关联表查询改用 `associationSheetTables`（取代点号解析 `selectedFields`，因存储格式为扁平数组不含 `.`）
- **重构**：`ExportFieldsCard` 移除点号解析逻辑，直接读 `task.associationSheetTables` 生成关联表 Tab

## 1.0.78 (2026-07-02)
- **重构**：预览功能改用微软 Office Web Viewer 直接预览 Office 文件，移除 `pm:list` 插件检测逻辑
- **原理**：Office 文件（xlsx/xls/docx/doc/pptx/ppt/odt）拼装 `https://view.officeapps.live.com/op/embed.aspx?src=<文件URL>` 在新窗口预览，与 NocoBase 官方预览插件底层一致
- **清理**：移除 `useRef`、`officeEnabled` 缓存、`pm:list` API 调用

## 1.0.77 (2026-07-02)
- **新增**：Office 文件预览插件检测 — xlsx/xls/docx/doc/pptx/ppt/csv 预览时自动检查 `@nocobase/plugin-file-previewer-office` 是否启用
- **优化**：未启用预览插件时弹出提示 + 自动打开文档链接，`useRef` 缓存检查结果避免重复 API 调用

## 1.0.76 (2026-07-02)
- **修复**：下载 URL 路径重复拼接 bug — `a.path` 已是包含文件名的完整路径，移除多余的 `/${a.filename}` 拼接

## 1.0.75 (2026-07-02)
- **修复**：下载按钮仍失败 — 增强 `getAttachmentUrl()` 三级 URL 兜底（`url \|\| preview \|\| path+filename`）
- **修复**：下载改用 `fetch() → blob → URL.createObjectURL()` 模式（参照 v2 `DisplayPreviewFieldModel`）
- **修复**：预览按钮无反馈 — 空 URL 时新增 `message.warning` 提示
- **优化**：下载增加 `finally` 清理（dom 移除 + 60s 后 revoke blob URL）

## 1.0.74 (2026-07-02)
- **修复**：控制台 Card `headStyle` 弃用警告（Ant Design v5 迁移至 `styles.header`）
- **修复**：详情页下载按钮 404 — `attachments:download` 非 NocoBase 有效 API，改为先调 `attachments:get` 获取文件 URL 再通过 `<a>` 下载
- **修复**：详情页预览按钮 404 — 同样改为先调 `attachments:get` 获取 URL 再 `window.open`

## 1.0.73 (2026-07-02)
- **优化**：导出字段卡片关联表 Tab 标签改为「表名称(表标识)」格式（如 `用户(users)`），替代之前的 `关联：users`
- **修复**：关联表字段标题缺失（仅主表字段有标题，关联表字段只显示 `标识(标识)`）— 补充查询关联表的 `tableFields` API
- **优化**：`ExportFieldsCard` 增加 `tableTitles` prop 支持

## 1.0.72 (2026-07-02)
- **修复**：任务列表文件名显示为「附件 #ID」而非真实文件名（导出完成后 `fileName` 未更新到任务记录）
- **修复**：任务详情缺少数据预览卡片（`DataPreviewCard` 缺少 `api` prop 导致预览 API 静默失败）
- **修复**：导入预览 API 的 POST 参数读取错误（未兼容 `ctx.action.params.values`）
- **新增**：导出任务详情新增数据预览卡片（查询前 5 条数据以表格展示）
- **清理**：删除 `src/client-v2/pages/tmp` 残留文件

## 1.0.71 (2026-07-02)
- **修复**：v2 导入预览不显示数据（调用 `sjgl02Import:preview` API 展示前 5 条）
- **修复**：v2 导出字段改为 Tabs 切换（主表字段 / 关联表字段分类展示）
- **修复**：文件下载失败（下载链接改为 `api.request({ responseType: 'blob' })` + Blob URL 方式）
- **修复**：文件预览新窗口打开失败（改用 `/api/attachments:download/{id}` 新窗口打开）
- **修复**：列表列宽不适配（文件名列去掉固定宽度）
- **修复**：关联表导出详情数据量显示兜底
- **新增**：`import.ts` 预览 API 支持 `previewLimit` 参数（默认 10 行）
- **新增**：`migrations/20260702170000-backfill-file-name.ts` — 回填旧任务 file_name

## 1.0.70 (2026-07-02)
- **新增**：`migrations/20260702160000-add-task-file-name.ts` — `beforeLoad` migration 确保 `file_name` 列存在
- **修复**：`yarn nocobase upgrade` 自动同步 `file_name` 列到 `sjgl02_tasks` 表

## 1.0.69 (2026-07-02)
- **新增**：`sjgl02_tasks` 表新增 `fileName` 字段（任务创建时自动存储文件名）
- **修复**：列表文件名显示附件 ID 而非真实文件名
- **修复**：创建人 `nickname/username/name` 多字段兜底
- **修复**：文件下载改用 `<a>` 标签直接下载（不经过 JSON 包裹）
- **修复**：数据预览卡片显示友好提示；执行日志空时显示友好提示

## 1.0.68 (2026-07-02)
- **回滚**：install() 中 `sjgl02_` 前缀过滤移除，恢复全部数据表权限

## 1.0.67 (2026-07-02)
- **修复**：Sjgl02SettingsPage 版本号从 v1.0.53 更新为 v1.0.66
- **修复**：预计剩余时间计算错误（中文字符串参与数学运算 → 直接用毫秒差计算）
- **修复**：取消任务按钮缺少错误反馈（加 `try-catch` + `message`）
- **优化**：Sjgl02Block 清理 25+ 未使用 antd 导入
- **优化**：install() 批量创建权限从 `for` 循环逐条改为 `Promise.all`
- **删除**：`plugin-top.txt` 残留旧代码文件（v1.0.47）

## 1.0.66 (2026-07-02)
- **修复**：查看任务详情报错 Invalid SQL — `createdBy.nickname` 跨表过滤改为两步查询
- **修复**：文件下载失败 — `window.open()` 不携带认证令牌 → 改用 `api.request()`
- **修复**：文件预览失败 — 同上，改用 `<a>` 标签直接下载

## 1.0.65 (2026-07-01)
- **修复**：ZIP 文件预览按钮不应出现（`isZip` 判断增加 `fileExt === 'zip'`）
- **修复**：任务日志查询改用 `offset/limit`（与 `page/pageSize` 统一）
- **修复**：任务详情各 API 请求独立 `try/catch`，历史任务容错
- **修复**：失败数量计算兼容 `errorLogs` 非数组的情况
- **优化**：执行日志查看器 API 失败静默处理

## 1.0.64 (2026-07-01)
- **重构**：任务管理模块全面重写 — 列表页 + 侧边详情 Drawer + 7 张信息卡片 + 终端风格执行日志
- **新增**：`sjgl02_task_logs` 数据模型（记录任务执行全过程日志：INFO/SUCC/WARN/ERROR）
- **新增**：`sjgl02TaskLogs:list` API + `writeTaskLog` 辅助函数
- **新增**：导入/导出任务执行时自动写入日志（开始/进度/批次/成功/失败/异常）
- **新增**：`src/client/panels/task/` 目录，5 个子文件：TaskList + TaskDetail + TaskCards + ExecutionLogViewer + shared
- **新增**：列表搜索支持任务ID/文件名/表名/创建用户；创建用户列
- **新增**：详情页侧边 Drawer（700px）：任务摘要/导出字段/关联表/导入配置/字段映射/数据预览/执行日志
- **新增**：终端风格执行日志查看器（深色背景 #1e293b、按级别着色、自动刷新、可折叠+独立滚动）
- **新增**：失败导入 — 数据预览显示 Excel 行号 + 错误原因 + 字段快照（最多 10 条）
- **新增**：字段映射自定义值显示实际填写内容；唯一值/必填标签
- **新增**：文件预览/下载按钮（导入源文件 + 导出文件，非zip支持预览）
- **优化**：导出文件元信息显示「完成于」；导入文件显示「上传于」
- **优化**：任务列表操作简化为查看详情 + 取消任务，其他操作移入详情页

## 1.0.63 (2026-07-01)
- **修复**：v1 页面区块右键菜单消失 — 新增 `x-toolbar: 'BlockSchemaToolbar'` 激活系统标准工具栏框架
- **修复**：v1 页面区块右键菜单只有「删除」— `sjgl02BlockSettings` 扩展为系统标准菜单项（修改标题/设置高度/联动规则/分割线/删除），名称保留 `blockSettings:sjgl02`
- **新增**：引入 @nocobase/client 标准组件 SchemaSettingsBlockTitleItem / SchemaSettingsBlockHeightItem / SchemaSettingsLinkageRules

## 1.0.62 (2026-07-01)
- **修复**：v1 页面区块右键菜单为空 — 注册自定义 `SchemaSettings`（名称 `blockSettings:sjgl02`，只含移除按钮），修正 `x-settings` 不存在于 NocoBase 内置列表的问题

## 1.0.61 (2026-07-01)
- **重构**：v1/v2 代码统一 — 删除 v2 重复页面（ImportTab/ExportTab/TaskTab，共 ~980 行），v2 设置页和区块模型直接引用 v1 面板
- **新增**：`src/client-v2/utils/api.ts` — 统一 `useAPI()` hook（兼容 v1/v2 两种运行时上下文）
- **重构**：3 个 v1 面板的 `useAPIClient()` → `useAPI()`
- **删除**：`useAPIClientCompat.ts`、`useFilteredTables.ts`（逻辑已内聚到面板中）
- **删除**：v2 重复页面 ImportTab.tsx (488行)、ExportTab.tsx (292行)、TaskTab.tsx (197行)

## 1.0.60 (2026-07-01)
- **修复**：v2 区块任务管理列表为空（API 响应数据解析层级错位：NocoBase 3层嵌套 `data.data.data`，少剥离了一层）
- **修复**：v1 区块注册增加 `RecordBlockInitializers` 和 `mobile:addBlock` 初始化器，覆盖更多 v1 页面场景

## 1.0.59 (2026-07-01)
- **修复**：v1 页面添加的区块无法移除（`Sjgl02BlockInitializer` 增加 `x-settings: 'blockSettings:block'`）
- **修复**：v2 区块权限管控不生效 — ImportTab/ExportTab 表列表按用户权限过滤
- **修复**：`useTablePermission` 增加 API 兜底（`auth:check`），兼容区块上下文中 `useCurrentUserContext()` 为空
- **新增**：`useFilteredTables` 共享 hook，统一处理表列表权限过滤 + admin/root 判断
- **优化**：ExportTab「全部数据表」仅 admin/root 可见

## 1.0.58 (2026-07-01)
- **修复**：v2 区块渲染崩溃（`useCurrentUserContext()` 返回 null 导致 `useTablePermission` 解构报错）

## 1.0.57 (2026-07-01)
- **新增**：v2 区块页面添加完整内容（导入/导出/任务管理三个 Tab），修复只显示顶部栏无内容的问题
- **优化**：v1/v2 预览表头改为上下两行显示（蓝灰分色）：「导入字段：xxx」上蓝色 + 「数据表字段：名称(标识)」下灰色，自适应高度
- **优化**：SjglBlockModel 使用 `lazy()` 按需加载各 Tab 组件，减少初始加载体积

## 1.0.56 (2026-07-01)
- **修复**：v2 页面「添加区块」菜单不显示"数据管理"区块 — v1 客户端补充 `registerModels({ SjglBlockModel })` 同步注册（参照所有官方 v2 区块插件的双端注册模式）
- **根因**：`buildSubModelItems` 使用 `getSubclassesOf`（同步方法）搜索 `_modelClasses`，仅 `registerModels` 可同步写入。`registerModelLoaders` 写入 `_modelLoaders` 需异步解析，同步搜索无法发现。

## 1.0.55 (2026-07-01)
- **修复**：v2 页面「添加区块」不显示"数据管理"区块 — 改用 v2 标准 API `registerModelLoaders`（替代 v1 遗留的 `registerModels`）
- **修复**：SjglBlockModel 的 `define({ label })` 改用 `tExpr()` 延迟翻译（遵循 v2 插件开发规范）
- **重构**：`src/client-v2/locale.ts` 新增 `tExpr` 导出，支持延迟翻译
- **重构**：`src/client-v2/plugin.tsx` 移除 `SjglBlockModel` 直接导入，改为按需加载（`extends: 'BlockModel'` + `loader`）

## 1.0.54 (2026-07-01)

### 界面优化
- Step2：文件信息、Sheet、表头行合并为一行，界面更紧凑
- Step3：4 个独立 Statistic Card 合并为 1 个摘要 Card，信息两列对齐
- 预览列名格式：`导入字段：xxx — 数据表字段：字段标题(field标识)`
- 预览标题改为「预览确认 — 导入到的数据表：表名称（表标识）」
- 管理员限制可导入字段显示「字段名称（字段标识）」格式
- 字段映射表增加「⚠ 必填」红色标签
- Sheet 下拉宽度自适应长名称

### 修复
- 自动匹配增强为 5 种匹配规则：精确匹配 / 标题匹配 / 括号提取 `1(field)` / 包含匹配 / 标题包含
- `doParse()` 保留用户自选的唯一值字段（之前无条件清空为 `[]`）
- 下一步按钮 update/upsert 强制要求唯一值字段（无论管理员是否配置）
- 自动匹配结果改为卡片标题内显示 Tag（不再弹出 message）

### 变更
- 版本号 1.0.53 → 1.0.54

## 1.0.53 (2026-07-01)

### 修复
- **核心Bug：doParse() 无条件清空唯一值字段** → 修复为保留管理员配置的值
- **核心Bug：自动匹配通过 setTimeout 读到空 Excel 表头** → 改用 useEffect 监听 excelHeaders 数据就绪后执行
- **核心Bug：`__custom__` 映射导致下一步按钮永久禁用** → 从禁用条件中移除 `__custom__` 判断
- **核心Bug：唯一值字段不在 importFields 白名单导致映射表不显示** → 始终包含唯一值和必填字段
- 导入模式从权限同步（`importMode` 默认值为可用模式中最优的，预览显示正确模式）
- 自动匹配优先按字段标题匹配 Excel 列名，匹配不到 + 必填 → 设为自定义填写
- 导出字段列表基于权限 `exportFields` 过滤（只显示管理员允许的字段）
- admin/root 导入权限短路（直接三种模式全部可用，不再显示红色「无权限」）

### 新增
- 导入必填字段实时校验提示（绿色 Tag = 已映射，红色 Tag = 未映射）
- 「🗑 清空」按钮一键清除所有字段映射
- 字段名称（字段标识）显示格式推广到唯一值字段和必填字段 Tag
- 导入模式仅 1 种可用时显示橙色 Tag 文字，多种时才显示下拉选择框

### 变更
- 版本号 1.0.52 → 1.0.53

## 1.0.52 (2026-06-30)

### 修复
- **v2 client-v2 构建失败**：`useAPIClient` 不存在于 `@nocobase/client-v2` → 创建 `useAPIClientCompat` 兼容 hook
- v2 添加区块改用 `registerModels` 同步注册 SjglBlockModel
- v1 添加区块改用初始器组件 `Sjgl02BlockInitializer` + `otherBlocks` 分组
- 非 admin/root 导出面板隐藏「📦 全部数据表」选项

### 新增
- 导入/导出面板基于用户权限过滤可选表（ImportPanel 仅显示 `canImport=true` 的表）
- 全部数据表导出列表格式「表名称（表标识）」
- 关联数据 Sheet 选项格式「表名称（表标识）」
- 关联字段显示模式下拉增加英文标签（显示值(Display) / 仅ID(ID only)）

### 变更
- 版本号 1.0.51 → 1.0.52

## 1.0.51 (2026-06-30)

### 重大变更
- **taskViewScope 改为按用户配置**：`sjgl02_settings` 新增 `userId` 字段，支持按用户独立读写
- 角色面板移除任务查看范围 Radio 设置（仅用户面板显示）

### 修复
- admin/root 始终可查看全部任务（`getTaskViewScope` 增加角色短路判断）
- `getSettings` GET 请求消除副作用（不再在查询不到时自动创建默认记录）
- 前端 `useTablePermission` 和 v1 ImportPanel 尊重用户级 `canImport=false` 否定
- 服务端 admin/root 权限检查优化（直接用 `ctx.state.currentUser.roles` 判断，省掉 DB 查询）
- `savePermissions` 校验 `importMode` 为空时自动补齐三种模式

### 变更
- 版本号 1.0.50 → 1.0.51

## 1.0.50 (2026-06-30)

### 修复
- **收起/展开分页修复**：收起继承权限后，分页基于可见项重新计算，自定义权限直接在第一页可见
- **选表下拉过滤修复**：只过滤已有自定义权限的表（`!_inherited`），角色继承的表允许添加自定义覆盖
- **前端权限一致性**：`useTablePermission` 和 v1 ImportPanel 优先检查用户级 canImport=false，不复用角色继承
- **getSettings GET 无副作用**：不再在查询不到记录时自动创建默认记录

### 新增
- `AGENTS.md` 补充权限开发约束：_inherited 标记必须 toJSON 后设置、admin/root 短路规则、前后端一致性要求

## 1.0.49 (2026-06-30)

### 重构
- 权限面板按 sjgl02-permission-prototype.html 原型图完全重写（16 个关键改动）

### 新增
- 继承权限「查看详情」只读弹窗（含来源角色、完整配置表）
- 子Tab：[✓ 权限配置] / [📋 操作日志]（审计日志表 sjgl02_permission_logs）
- 权限分区收起/展开（▼ 📦 / ▶ ✏️）
- 批量操作：全选 Checkbox + 批量删除 Popconfirm
- 角色显示格式：管理员（admin）、编辑（editor）
- 字段显示格式：姓名（name）
- 数量化标签：可导入: N个字段 / 可导出: N个字段
- admin/root 所有表权限（含 sjgl02_ 系统表）自动补齐

### 修复
- **核心Bug：_inherited/_systemManaged 标记序列化丢失**：Sequelize 模型实例设置属性无效，改为 `p.toJSON()` 转纯对象后再设置
- **添加权限按钮逻辑修复**：从 `!perms.every(p => p._inherited)` 改为 `!isSystemManaged`
- 默认任务查看范围 `'all'` → `'own'`
- admin/root 自动补齐去除 `sjgl02_` 前缀过滤，含系统表权限
- Dragger 导出空指针修复

### 删除
- 卡片上 Switch 导入/导出开关（移到编辑弹窗内）
- ⚡自定义标签（不再显示）

## 1.0.48 (2026-06-30)

### 深度重构
- 架构升级：创建 `src/client-v2/hooks/` + `src/client-v2/types/` 目录，7 个共享 hooks
- v1 plugin.tsx 拆分：1204 行 → 5 个独立 Panel 文件（ImportPanel/ExportPanel/TaskPanel/PermissionPanel/Sjgl02Block）
- v2 PermissionTab 重构：355 行 → 220 行（-38%），使用共享 hooks
- v2 ImportTab 重构：使用 useTablePermission hook，消除冗余 auth:check 请求

### 数据模型升级
- sjgl02_table_permissions 新增：permissions JSON 字段（未来扩展）、priority 优先级字段、createdAt/updatedAt/createdById 审计字段
- 新增 sjgl02_permission_logs 审计日志表（action/targetType/targetId/tableName/changes/operatorId/createdAt）
- savePermissions 自动记录 create/update/delete 操作到审计日志

### 新增功能
- v2 权限面板批量操作：全选 Checkbox + 批量删除（Popconfirm 确认）

### 文件结构变更
- 新增：`src/client-v2/hooks/` 下 7 个 hook 文件 + `index.ts` 桶导出
- 新增：`src/client-v2/types/permission.ts` 类型定义
- 新增：`src/client/panels/` 下 6 个 Panel 文件 + `shared.ts`
- 新增：`src/server/collections/sjgl02_permission_logs.ts`
- 精简：`src/client/plugin.tsx` 1204 → 57 行
- 重构：`src/client-v2/pages/PermissionTab.tsx` 355 → 240 行

## 1.0.47 (2026-06-30)

### 严重修复
- install() 数据重复创建：创建循环从外层 for tables 内部移到外部，消除多项式级数重复（104 张表避免创 5000+ 条）
- 数据库添加 UNIQUE(targetType, targetId, tableName) 唯一约束，防止重复记录和并发竞态

### 修复
- getPermissions admin/root 自动补齐改为批量创建（收集到数组后逐个 INSERT）
- 前端导入面板（v1+v2）权限模式限制修复：仅查询当前用户权限，消除 N+1 API 请求
- permission-check.ts 多角色权限取最宽松（canImport=true 优先），不再只取单条最高 ID
- Alert 提示文案加入"超级管理员"，覆盖 root 角色

### 新增
- admin/root 权限服务端新增 `_systemManaged: true` 标记
- 前端权限卡片区分三种标签：系统管理（蓝色）、继承（紫色）、自定义（橙色）

## 1.0.46 (2026-06-30)

### 新增
- 服务端权限强制校验：导入/导出操作通过 `permission-check.ts` 检查 `sjgl02_table_permissions` 表权限
- 导入模式校验：服务端校验请求的 importMode 是否在权限允许范围内
- 字段级权限过滤：导入时校验字段映射是否在 `importFields` 允许范围内，导出时校验 `exportFields`
- 全表导出逐表权限检查：`__all__` 模式对每个表逐表检查 export 权限，无权限的表自动跳过

### 修复
- admin/root 角色自动补齐权限时 `targetName` 区分「管理员」和「超级管理员」（修复硬编码问题）
- v1 自动保存只发送非继承权限（`_inherited !== true`），消除继承权限被错误修改的风险
- v1 Switch 组件 `checkedChildren/unCheckedChildren` 文案区分（导入/关、导出/关），修复之前两个状态文案相同
- 前端 `_inherited` 标记被 `map` 覆盖：`{ ...p, _inherited: false }` 改为 `{ ...p, _inherited: p._inherited ?? false }`，保留服务端设置的标记
- 用户拥有多角色时继承权限按 `tableName` 去重，消除 React 重复 key 警告

### 变更
- 新增 `src/server/actions/permission-check.ts` 权限检查工具模块
- `executeImport` 新增权限检查、导入模式校验、字段级权限过滤、必填字段校验
- `executeExport` 新增单表权限检查和字段级过滤、全表模式逐表权限检查

## 1.0.27 (2026-06-29)

### 文档修正
- README.md：API 端点恢复准确（移除不存在的 upload/logs 端点、修正 preview 方法、更正数据模型字段和类型）、翻译键计数 92→115
- 产品文档.html：v3.8→v3.9，移除不存在的 API 端点（upload/logs/progress），修正所有数据模型字段和类型，修正实现说明
- CHANGELOG.md：补全 1.0.20~1.0.26 版本条目
- 修正 v1/v2 客户端版本号显示（v1.0.24 → v1.0.27）

## 1.0.40 (2026-06-30)

### 修复
- 弹窗"允许导入/导出"开关联动：关闭时自动隐藏对应配置区域
- 唯一值字段联动：仅当导入模式含 update/upsert 时必填并显示必填校验
- 已有设置 taskViewScope 默认值修正为 'all'

### 新增
- v1 侧栏表名搜索功能
- 字段显示格式统一为 字段名称（字段标识）

## 1.0.39 (2026-06-30)

### 新增
- 导入模式改为多选（支持同时勾选 insert/update/upsert），权限卡片用中文 Tag 显示
- 权限管理页面左侧搜索用户/角色，右侧搜索表名（v1+v2）
- 导入面板导入模式下拉根据权限配置动态过滤可选模式

### 变更
- `sjgl02_table_permissions.importMode` 字段类型 `string` → `json`（数组），数据库列 `VARCHAR` → `JSONB`
- 导入模式选项中文标签：「新增」「更新」「新增+更新」

## 1.0.38 (2026-06-30)

### 修复
- 默认任务查看范围改为"全部"（插件安装和设置默认值均改为 `'all'`）
- 权限弹窗字段选择下拉显示格式改为 `字段名称（字段标识）`（如 `姓名（name）`）
- 权限卡片表名显示改为 `表名称（表标识）`（如 `用户（users）`）
- 修复 plugin.ts 缺少的 `}` 导致服务端编译失败

## 1.0.37 (2026-06-29)

### 修复
- **角色权限加载失败**：roles 表主键是 `name`（字符串），改为用 `r.name` 作为角色标识符，修复 `r.id` 为 undefined 导致权限无法加载的根因
- getPermissions 角色查找改为 `filter: { name: targetId }`，不再用 parseInt
- install 预设权限同时给 admin 和 root 创建

## 1.0.36 (2026-06-29)

### 修复
- 权限管理 root 角色也享受自动同步：打开 root 角色时自动补齐全部数据表权限

## 1.0.35 (2026-06-29)

### 修复
- 权限管理 v1 弹窗保存功能修复：`savePerms` 改为读取表单值，拼接 targetType/targetId/targetName，新增时可正常保存
- 移除旧数据角色名→数字ID的转换逻辑（系统角色直接使用数字ID）

## 1.0.34 (2026-06-29)

### 修复
- 导出附件 FileId 字段（如 exportFileId）Excel 列显示为附件文件名（与 ZIP 中一致），不再显示原始数字

## 1.0.33 (2026-06-29)

### 修复
- 权限管理 `targetId` 空值防护：getPermissions/savePermissions 增加 targetId 有效性校验，避免 "undefined" 字符串写入数据库

## 1.0.32 (2026-06-29)

### 修复
- 权限管理角色 ID 改用数字编号（`r.id`），修复 `invalid input syntax for type integer` 错误
- 角色名显示修复：检测到 i18n 模板 `{{t("Admin")}}` 时改用英文名显示，不再显示乱码
- 管理员角色自动补齐新增数据表的权限（每次查看权限时自动同步）
- 兼容旧数据：`targetId` 从角色名自动转为数字 ID

### 变更
- `getUserRoleList` 返回修正：`title` 去 i18n 模板化
- `getPermissions` 新增管理员自动同步逻辑
- `plugin.ts` install 改用 `adminRole.id`

## 1.0.31 (2026-06-29)

### 修复
- 任务管理中查看全部数据表导出任务时，不再报 "Table __all__ not found" 错误
- 服务端 `getTableFields` 兼容 `tableName='__all__'`（返回空数组）
- v1/v2 任务详情抽屉中 `__all__` 表名显示为「全部数据表」

## 1.0.30 (2026-06-29)

### 修复
- 附件导出支持 integer 类型 FileId 字段（如 `exportFileId`、`importFileId`），自动查 attachments 表获取文件路径并打包进 ZIP

## 1.0.29 (2026-06-29)

### 修复
- Sheet 切换时自动清空字段映射、自定义值、唯一值字段配置，避免旧 Sheet 的配置残留
- 预览表头按钮旁新增 Excel 列数和数据行数统计（如 `共 15 列 / 1256 行数据`）

## 1.0.28 (2026-06-29)

### 新增
- 导出附件功能：勾选「包含附件文件」后，服务端识别 attachment 类型字段，将附件文件与 Excel 打包为 ZIP
- 导出日期格式改为本地时区 `YYYY-MM-DD HH:mm:ss`（date/datetime/datetimeTz/unixTimestamp 四类字段）
- 导入支持 ISO 格式日期自动转换（`2026-06-29T12:00:00.000Z` → `2026-06-29 12:00:00`）
- 导入字段映射表中 `updatedAt` 字段显示 🔒 只读标签，不允许映射（系统自动填充）
- 修复 `formatValue` 中 `typeof === 'object'` 拦截 Date 对象的问题（Bug 修复）

## 1.0.25 (2026-06-29)

### 新增
- 导入面板新增 `📋 预览表头` 按钮，点击弹框显示表头列和前10行预览数据
- 弹框含 Sheet 名称、表头行、数据行数概览信息
- 切换 Sheet 名称或表头行时自动重新解析表头

### 变更
- `uploadParse` 接口支持 `sheetName`/`headerRow` 参数，返回 `previewRows`（前10行）和 `totalRows`
- v1/v2 客户端同步新增 `useEffect` 监听 Sheet/表头行变化，自动调用 `doParse`
- 刷新按钮传参 `sheetName`/`headerRow` 支持指定位置刷新

## 1.0.24 (2026-06-29)

### 修复
- v1 `upload→uploadParse` 接口名称修正
- v1 preview HTTP 方法 GET→POST 修正
- v2 PermissionTab.tsx TS 类型修复
- v2 Sjgl02SettingsPage.tsx ctx 空值防护

## 1.0.23 (2026-06-28)

### 修复
- 导入字段映射支持自定义值注入
- makeRecord 内部合并 customValues
- 导出关联 Sheet 命名格式修正

## 1.0.22 (2026-06-28)

### 新增
- 导入唯一值字段验证（同批次重复检测 + 数据库重复检测）
- 自定义值标签显示

## 1.0.21 (2026-06-27)

### 修复
- 导出 `dataWrapping` 中间件兼容
- exportFilter 筛选格式转换
- 物理删除旧权限记录

## 1.0.20 (2026-06-27)

### 新增
- 表级权限管理（用户/角色维度）
- 安装预设管理员权限

## 1.0.19 (2026-06-26)

### 新增
- 任务管理面板（列表 + 详情抽屉）
- 错误日志显示（excelRow 列、字段快照）

## 1.0.18 (2026-06-26)

### 新增
- 导出全部表功能（ZIP 打包）
- 导出文件名模板 `{表名}_{日期}.xlsx`
- 关联 Sheet 支持

## 1.0.0 ~ 1.0.17

- 初始版本及迭代优化
- Excel 导入/导出核心功能
- 字段映射配置
- 关联数据处理
