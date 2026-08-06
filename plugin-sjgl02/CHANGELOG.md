# 更新日志

## 2.2.10（2026-08-03）

- **修复（数字字段支持货币符号/千分位）**：`value-converter.ts` 新增 `parseNumericValue` 宽松解析——先按标准 `Number` 转换，失败时剥离货币符号（¥￥$€£）、千分位逗号、空白后重试。解决快手小店批量导出 Excel 金额列 `¥39.9` 导致「数字转换失败」整批回滚的问题（`"¥39.9"→39.9`、`"1,234.56"→1234.56`；纯数字行为不变；与库内 double 精度字节级一致）。应用于 integer/bigInt/sort/float/double/real/decimal/percent 全部分支。
- **修复（失败/取消任务可下载导入源文件）**：任务详情下载卡片显示条件从「仅 succeeded」放开为「succeeded/failed/canceled 均显示」——失败任务可下载源文件排查问题（橙底+失败 Tag），取消任务灰底可下载；「下载导出文件」按钮仍仅成功任务显示（失败/取消无导出结果文件）。
- **实测验证（副本库 5433）**：快手小店批量导出文件（6226 行，实付款全列 `¥39.9`）真实导入 `t_i4nir4gzdyx` 成功——20 行新订单验证 `¥39.9` → 数字 `39.9` 入库；失败任务 #13 `type=source` 下载返回 200 完整文件（1.95MB）。验证后已清理测试数据。

## 2.2.9（2026-08-03）

- **修复（CSV 长数字精度丢失）**：CSV（及 xls）解析时，超出 JS 安全整数范围（`Number.MAX_SAFE_INTEGER`）的整数字段（如抖音/微信小店 19 位订单号、商品ID）会被 xlsx 库按 number 解析导致尾数失真（如 `6928398432836681375` → `6926177404384148000`）。修复：`excel-parser.ts` 新增 `normalizeCsvCells`，此类单元格改用格式化文本原文保留（转字符串），普通数字（数量/金额）不受影响。
- **修复（CSV 表头 BOM 污染）**：UTF-8 BOM（\uFEFF）会粘在首列表头导致自动匹配失败，读取时剥离。
- **修复（CSV 值前导 Tab）**：抖音等平台导出的 CSV 字段值带前导 Tab，导入值含脏字符，统一清理首尾 Tab。
- **实测验证**：抖音订单 CSV（36,624 行，含 19 位订单号/商品ID）副本库真实导入成功，订单号/子订单号/商品ID 完整保真，商品名无 Tab 脏字符。

## 2.2.8（2026-07-31）

- **修复（导入/导出步骤1 数据表下拉搜索失效）**：C1 图标统一后 `label` 变为 ReactNode，`optionFilterProp="label"` 无法匹配导致搜不到。改为自定义 `filterOption`（按数据表 title/name 纯文本匹配），图标保留。
- **优化（导出步骤2 默认排序）**：进入步骤2 时已选字段按当前权限配置的 `exportFields` 顺序初始化（白名单非空时），与权限管理里拖拽好的排序一致；未配置白名单时按数据表原始顺序。
- **优化（权限「新增权限」分步展示）**：新增模式下未选择数据表时仅显示「选择数据表 + 允许导入/允许导出开关」，选中数据表后按开关状态展开导入/导出详细配置区；编辑模式保持全展开。
- **优化（导入步骤2 界面）**：
  - 颜色统一：权限切换卡/唯一值卡标题及权限摘要 5 个字段标题由紫/橙改为中性深灰 `#333`，摘要背景改白底，视觉更清爽；
  - 权限说明（含"此表您拥有的权限配置"）合并到卡片顶部一条 Alert，位于下拉框之前；
  - 空值唯一值预检说明并入唯一值字段说明行（位于"唯一值字段由权限配置锁定"之后）；
  - 唯一值字段下拉支持关键字搜索（字段名称/字段名均可匹配）；
  - 字段映射区块改为可折叠（Collapse，默认展开），统计信息（共X列/已用Y/剩余Z）移到折叠标题。
- **代码结构（500 行规范）**：PermEditModal（797→428 行）拆分出 `PermEditWidgets`（ChipsSelect/SortableFieldList/FieldBlock）、`PermCopyFromConfigModal`。
- **构建修复**：顺带修复 PermEditModal 既有 `promise/catch-or-return` 3 处。

## 2.2.7（2026-07-31）

- **修复（导出步骤2字段排序真正生效）**：此前拖拽/上下移/序号修改只改 `state.selectedFields`，但界面列表用 `groupFields.filter(...)` 推导，始终按数据表原始顺序渲染，导致操作"看起来没生效"、且界面顺序与实际导出列顺序不一致。已改为按 `selectedFields` 顺序取列表，拖拽/上下移/序号即时生效并与导出列顺序一致。
- **新功能（复用其他方案的字段排序）**：导出步骤2新增「复用其他方案排序」按钮 + 弹窗（新后端接口 `sjgl02:listExportSchemes`，所有登录用户可查看该表全部导出方案）。选择任一方案仅复用其字段顺序重排当前已勾选字段（不改变勾选集合、无权限字段不参与、方案外字段保持原相对顺序排在末尾），提交导出仍按自己的权限白名单校验。
- **优化（任务中心轮询）**：无 pending/running 任务时不再启动 5 秒轮询 interval，避免空转请求。
- **优化（任务中心统计卡片选中态）**：点击状态统计卡片过滤后，卡片高亮（主题色边框+浅底）显示当前选中状态。
- **优化（任务中心日期范围过滤）**：工具栏新增日期范围选择器（RangePicker），按任务创建时间过滤，与类型/状态/关键词过滤叠加。
- **优化（失败原因聚合 Top10）**：任务详情失败明细上方新增按「字段+原因」聚合的 Top10 统计 Tag（按失败数降序，高频标红）。
- **优化（导入确认弹窗增强）**：确认弹窗补充唯一值字段、附件概要、有效映射列数、Sheet 名与表头行。
- **优化（界面图标统一）**：全部 client-v2 界面功能类 emoji 替换为 `@ant-design/icons` 图标（保留 👤/🔐 权限语义标识与状态圆点），视觉更统一、支持主题色。
- **代码结构（500 行规范）**：ExportStep2 / ImportStep2 / TaskDrawer 拆分出 12 个子组件与共享工具（`export-options`、`SortableExportRow`、`ExportFilterSection`、`ExportRelationSection`、`ExportAllTablesSection`、`ImportPermissionSummary`、`ImportAttachmentCard`、`ImportSystemFieldsCard`、`TaskPreviewTable`、`TaskErrorLogs` 等），全部文件 ≤500 行。
- **构建修复**：`run-task.ts` / `worker-entry.ts` 的 `collections repository .load()` 类型错误（NocoBase 类型定义缺失）按 core `db-sync.ts` 一致做法加 `@ts-ignore`，解除 buildDeclaration 失败。

## 2.2.6（2026-07-31）

- **优化（写入性能 50 倍提升）**：快速路径的 `model.update` WHERE 条件从复合唯一值（`订单号+商品编码`，无索引时全表扫描 16 万行，155ms/行）改用主键 ID（`WHERE id = ?`，走主键索引，3ms/行）。1.9 万行 upsert 预计从 54 分钟降至约 1 分钟。使用 `collection.model.primaryKeyAttribute` 动态获取主键字段名，不依赖硬编码 `id`。

## 2.2.5（2026-07-30）

- **修复（权限管理页面报错 activeKeys is not defined）**：2.2.4 清理冗余三元时误删了 `activeKeys` 变量定义但未更新引用处，导致页面崩溃。已改为直接硬编码 `defaultActiveKey={['users', 'roles']}`。
- **修复（导出步骤2拖拽/序号/上下移全部失效）**：`Collapse` 的 `items` API 对 `children` 做了内部 memoization，导致 `onDragEnd`/`onMove`/`onRemove` 回调闭包过期，引用旧的 `state.selectedFields`，操作无效。改为 `Collapse.Panel` 子组件方式，确保每次渲染重建闭包。
- **修复（导出步骤2序号跳转索引错位）**：删除 `window.dispatchEvent` + `useEffect` 机制，改为 `onJumpTo` 回调直接传组内目标索引，调用处做全局索引转换（与 `onDragEnd`/`onMove` 统一逻辑）。

## 2.2.4（2026-07-30）

- **修复（导出步骤2序号跳转失效）**：`SortableExportRow` 序号编辑后 dispatch 事件但父组件无监听，导致输入序号回车后行不跳转。已添加 `useEffect` 监听 `sjgl02-export-row-move` 事件。
- **修复（权限管理排序双重触发）**：`SortableRow.commitMove` 既调用 `onMove`（移一格）又 dispatch 事件（跳到目标），双重触发导致移动错乱。已删除 `onMove` 调用，只保留事件跳转。
- **修复（复制方向错误）**：权限配置弹窗中导出区域的「从其他配置复制」按钮错误地复制到导入字段。`toolbarButtons` 的 `copyFromConfig` 参数改为 `'import'`/`'export'` 字符串，正确区分目标区域。
- **修复（retry 补全）**：重试任务补充 `permissionLabel`；增加原任务状态校验（仅失败/已取消可重试）。
- **修复（emoji 不一致）**：导入任务 permissionLabel 角色图标从 `👥` 统一为 `🔐`，与导出一致。
- **修复（worker RUNNING 重复写入）**：worker 子进程路径跳过 RUNNING 状态写入（主进程 `executeViaWorker` 已写过），避免 `startedAt` 被覆盖。
- **优化（循环依赖消除）**：`fieldLabel` 函数抽到独立文件 `field-utils.ts`，消除 `ImportStep2` 与 `MappingTable` 的循环依赖。
- **优化（冗余代码清理）**：`TargetSidebar` 删除无意义的三元表达式（两分支结果相同）。

## 2.2.3（2026-07-29）

- **修复（唯一值字段为忽略能点下一步）**：upsert/update 模式下，如果唯一值字段在映射表中设为"忽略"，前端"下一步"按钮禁用并提示"唯一值字段不能设为忽略"。
- **修复（必填字段为忽略能点下一步）**：权限配置的必填字段如果设为"忽略"，前端"下一步"按钮禁用并提示"必填字段不能设为忽略"。
- **修复（快速路径丢弃 createdAt/createdById）**：2.2.2 的快速写入路径排除了 createdById/createdAt，导致用户映射了这些字段时 Excel 的值被丢弃。改为检查映射表，如果用户映射了这些字段（非忽略）则保留。

## 2.2.2（2026-07-29）

- **优化（写入性能 20 倍提升）**：upsert/update 模式的 update 路径从 `repo.update()`（经 NocoBase 中间件链，68ms/行）改为 `model.update(..., { hooks: false })`（直接 Sequelize，3ms/行）。通过 `rawAttributes` 过滤非数据库列（关联数组），排除 `createdById`/`createdAt`。有 appendFields 时自动降级为原路径。create 路径不变（需要 hooks 生成 ID/加密密码）。1.9 万行 upsert 预计从 22 分钟降至约 1 分钟。性能日志中标注"快速"/"慢速"路径。

## 2.2.1（2026-07-29）

- **新功能（性能日志）**：upsert/update 模式导入时记录每批的预加载耗时、写入耗时（更新/新增数量），在任务详情的"⏱ 性能日志"面板中展示，方便定位瓶颈。
- **优化（worker 阈值）**：worker 子进程启动阈值从 5 万行降为 1 万行，1 万行以上的导入/导出任务走 worker 子进程执行，不阻塞主进程 API。

## 2.2.0（2026-07-29）

- **修复（任务详情预览只显示自定义内容）**：后端 `previewRows` 保存的是对象（`{field: value}`），前端按数组索引取值导致 Excel 列值全部为空。改为按字段名从对象取值。
- **修复（操作日志操作人显示"-"）**：`writeLog` 未传 `context` 给 `create`，NocoBase 的 `createdBy: true` 机制无法注入操作人。改为传 `options.context`，让框架自动注入。
- **优化（导入步骤2权限摘要可收起）**：权限切换的详情区块从 `Card` 改为 `Collapse`，默认收起，标题显示权限名称+模式简要，点击展开看详情。
- **优化（导出步骤2字段选择列表模式+拖拽排序）**：字段选择从 Checkbox 平铺改为列表模式（序号+拖拽手柄+上移下移+删除），保留常规/日期/关联/附件四个分组，每组内可拖拽排序。日期格式和关联格式配置保留在每行右侧。

## 2.1.9（2026-07-29）

- **优化（导入性能 - 批量预加载）**：upsert/update 模式从逐行 `findOne` 查询改为分批预加载（每 2000 行一批），用一条 `WHERE field IN (...)` 批量查询已存在的记录构建内存 Map，后续逐行从 Map 中查找。1.9 万行 upsert 预计从 16+ 分钟降至 30 秒左右。
  - 新增 `PRELOAD_CHUNK = 2000` 常量和 `processUpsertChunk` 方法；
  - 复合唯一值（多字段组合）用第一个字段做 `WHERE IN` 预加载，内存中按完整组合精确匹配；
  - 批量预加载时统一带 `appends`（追加更新的关联字段）。

## 2.1.8（2026-07-29）

- **优化（previewExcel 异步化）**：导入向导从步骤1进入步骤2时不再阻塞等待预览请求，改为后台异步加载，立即进入步骤2。预览加载中显示 Spin，失败显示错误提示和重试按钮，不阻止用户继续配置映射。解决大文件预览超时（CDN 524）导致卡在步骤1的问题。
- **修复（操作日志操作人没显示）**：后端权限日志 hook 中 `?.state?.currentUserId` 改为 `?.state?.currentUser?.id`（NocoBase 注入的是 `ctx.state.currentUser.id`）；前端 `getPermLogs` 添加 `appends: ['createdBy']`；操作人列改为显示 `createdBy.nickname/username`。
- **优化（权限管理字段显示统一）**：`PermCardList` 卡片摘要/详情弹窗、`PermLogTable` 变更详情中的字段显示统一为「字段名称(字段名)」格式，通过异步加载 `getCollectionMeta` 构建 `name -> title` 映射缓存。
- **优化（任务详情预览表头两行显示）**：导入任务预览表头改为两行格式（第一行蓝色「导入: Excel列名」，第二行「字段名称(字段名)」），与导入步骤3一致；导出任务预览表头也改为 `fieldLabel` 显示「字段名称(字段名)」格式。

## 2.1.7（2026-07-29）

- **新功能（权限管理 - 字段排序增强）**：
  - **序号可编辑**：字段排序列表中的序号可点击编辑，输入目标序号回车后直接移动到对应位置，字段多时无需反复拖拽。
  - **全选/清空移到标题栏**：从列表底部移到 Collapse 标题栏右侧，与展开/收起按钮同一行，操作更集中。
  - **一键复制导入/导出字段**：可导入字段区块显示「📋 复制导出字段」按钮，可导出字段区块显示「📋 复制导入字段」按钮，目标有内容时弹确认框。
  - **从其他配置复制**：新增「📋 从其他配置复制」按钮，弹窗选择其他用户/角色的同表权限配置（仅显示有当前表配置的），一键复制其字段配置。新增后端 API `sjgl02:permListByCollection` 支持按表名查询所有配置。

## 2.1.6（2026-07-28）

- **修复（导出报错 config is not defined）**：`export.ts` 中 `permissionLabel` 引用了 `else` 块内的 `const config`，块级作用域不可达。改为在外层 `let` 声明，`else` 块内赋值。
- **修复（权限显示 #1 (user)）**：`sjgl02Tasks` 集合定义中缺少 `permissionLabel` 字段，数据库表没这列，后端存的 `permissionLabel` 写不进去。已添加字段定义，部署后需执行 `yarn nocobase upgrade` 同步表结构。
- **修复（字段排序不生效）**：权限配置中拖拽排序的 `importFields`/`exportFields` 顺序，之前在导入步骤2和导出步骤2中被忽略（只做白名单过滤，按 `meta.fields` 原始顺序）。现已改为：白名单非空时按权限配置的字段顺序排列字段。
  - 导入步骤2：`useImportableFields` 按 `importFields` 数组顺序重排字段映射表
  - 导出步骤2：`groups` 组内按 `exportFields` 数组顺序重排字段列表

## 2.1.5（2026-07-28）

- **修复（单表导出大数据报错）**：`getPkName` 处理复合主键（`filterTargetKey` 为数组）的情况，取第一个字段作为游标，修复 `sortKey.startsWith is not a function`。
- **优化（任务详情展开/收起）**：任务详情抽屉中各子区块（配置详情/字段映射/导入统计/导出字段/数据预览/错误明细）改为 Collapse 折叠面板，默认展开核心区块、收起数据预览，下载区始终展开。
- **优化（字段显示格式统一）**：导入步骤3唯一值字段、导出步骤3选中字段 Tag、任务详情错误明细表 Field 列，3 处统一为「字段名称(字段名)」格式。

## 2.1.4（2026-07-28）

- **优化（导入性能 P0）**：upsert/update 模式下唯一值查询改用 `existCache` 缓存（相同唯一值组合不重复查库），系统字段 userId 校验改用缓存（同一用户只查一次）；BATCH_SIZE 从 500 提升到 2000；附件处理预查询 storage 信息（从每文件查一次改为全局查一次）。1 万行 upsert 预计从 27 分钟降至 1-3 分钟。
- **修复（createdBy/updatedBy）**：使用用户权限导入时，数据 createdBy/updatedBy 现在恒为实际操作人（权限用户仅控制字段/模式权限，不影响数据归属），废弃 ADR-019 的权限用户替换逻辑。
- **修复（权限配置显示）**：任务详情中权限配置从 `#1 (user)` 改为显示友好名称（如 `👤 小王`），后端冗余存储 `permissionLabel`。

## 2.1.3（2026-07-28）

- **新功能（权限管理 - 字段排序）**：权限配置弹窗中「可导入字段」和「可导出字段」支持拖拽排序（dnd-kit）和上移/下移按钮，字段顺序即为导入/导出列顺序；每个子区块（导入模式/唯一值字段/必填字段/可导入字段/可导出字段）支持展开收起。
- **优化（导入步骤2 - 字段显示格式统一）**：权限摘要 Tag、已选唯一值 Tag、主键 Tag、列占用提示、错误提示等 9 处字段显示统一为「字段名称(字段名)」格式，与映射表主列保持一致。

## 2.1.2（2026-07-28）

- **修复（P1）**：`run-task.ts` 中 `app.pm.get(PluginSjgl02Server)` 构造函数引用查找改为字符串名称查找 `app.pm.get('@my-project/plugin-sjgl02')`，与 `worker-entry.ts` 保持一致，避免模块引用不一致导致查找失败。
- **优化（权限管理 - 用户/角色展开收起）**：侧边栏用户列表和角色列表改为 `Collapse` 折叠面板，默认展开，可手动收起；面板标题显示数量，搜索时保持展开。
- **优化（权限配置 - 字段搜索 + 全选/清空）**：`ChipsSelect` 组件添加 `showSearch` 关键字搜索（按字段名称/标识过滤）和「全选」「清空」快捷按钮，字段多时可快速定位和批量操作。

## 2.1.1（2026-07-28）

- **修复（生产 Docker 环境大数据任务卡在"排队中"）**：生产环境中 worker 子进程 spawn `@nocobase/app` 入口后，经 Gateway.run -> runAsCLI -> loadCommands 加载所有插件 commands 文件，某第三方/Pro 插件 commands 文件 `importModule` 返回非函数导致 `callback is not a function`，`loadCommands` 整体失败，`sjgl02:run-task` 命令无法注册，worker 启动即失败，任务永远卡在 PENDING。
  - **修复 1（核心）**：新增独立 worker 入口 `worker-entry.ts`，不经过 `Gateway.run()` 和命令系统，直接 `new Application()` -> `app.load()` -> `executeAsWorker(taskId)`，彻底绕过 `loadCommands`；`worker-task-runner.ts` 的 worker 入口从 `@nocobase/app/lib/index.js` 改为插件自己的 `worker-entry.js`；
  - **修复 2**：`executeViaWorker` 在启动 worker 前将任务状态从 PENDING 改为 RUNNING（与 `execute` 进程内路径保持一致），确保 worker 启动失败时 `ensureNotRunning` 的 filter 能正确匹配；
  - **修复 3**：`ensureNotRunning` 与 cancel 路径的 filter 从 `{ status: RUNNING }` 改为 `{ status: [RUNNING, PENDING] }`（双保险），确保任何中间状态都能被正确清理为 FAILED/CANCELED，不再卡在"排队中"。

## 2.1.0（2026-07-27）

- **新功能（大任务 worker_threads 子进程执行，方案 B 落地）**：对照官方 `plugin-async-task-manager` 的 `CommandTaskType` 机制，行数 ≥ 5 万的导入（提交时记录 `plannedRows`）与「全部数据表」导出任务改由 `WORKER_MODE='-'` 瞬态 NocoBase 子应用线程执行，大任务的 CPU 密集工作彻底移出主进程事件循环；小任务维持进程内执行（方案 A 让出已覆盖）。
  - 新增命令文件 `server/commands/run-task.ts`（`sjgl02:run-task --taskId`，`.preload()` 触发完整应用加载；手动加载 DB 动态集合；命令结束显式 `process.exit` 防止线程残留卡死队列）；
  - 新增 `WorkerTaskRunner`（spawn/取消先 IPC 优雅回滚 30s 超时强杀/异常退出兜底标记失败）；
  - `task-queue` 增加混合调度（`shouldRunInWorker`）与 `executeAsWorker` worker 入口；
  - worker 瞬态模式下跳过队列订阅（interval 会阻止线程退出）与残留任务恢复（避免误标主进程任务）。
- **实测**（生产模式）：6 万行导入、20 万行导入、全表导出 worker 执行全部成功；worker 执行期间 API 延迟全部 <100ms（趋近空闲水平）；running 期取消 → IPC 优雅回滚 +「已取消」终态；连续多个 worker 任务队列不卡死；小任务进程内路径回归正常。
- **顺带修复（官方插件 bug）**：`@nocobase/plugin-file-manager` 的 `server/commands/repair-filenames` 缺 default export，导致 `runAsCLI`（worker 链路依赖）报 `callback is not a function`，已在该插件源码补 default export 并重新构建（属官方代码，升级官方版本时注意回归）。

## 2.0.9（2026-07-26）

- **优化（任务执行期间系统卡顿缓解，方案 A）**：导入/导出引擎在批量行处理循环中周期性让出事件循环（`setImmediate`），任务执行期间 API 请求可正常穿插处理，不再出现长时间页面无响应：导入行循环每 200 行、附件处理每 50 条、导出行循环每 200 行、关联表写入每 500 行、附件收集每 100 条各让出一次，吞吐损耗可忽略。已知局限：.xls/.csv 为整文件一次性同步解析（库限制），解析阶段仍可能短暂卡顿，解析后的处理阶段已覆盖让出。

## 2.0.8（2026-07-26）

- **修复（/admin 无 /v/ 前缀访问）**：NocoBase 双运行时中，v1 运行时（/admin 路径）只加载插件 v1 入口，此前 v1 入口为空壳导致：设置页 /admin/settings/sjgl02 不存在、v2 页面（flowPage）在 v1 运行时内嵌渲染时 sjgl02 区块报 "Model class not found" 且无法添加。本次补齐 v1 入口（与官方插件双注册做法一致）：
  - `src/client/models` 注册 `Sjgl02BlockModel`——/admin 路径下 v2 页面的 sjgl02 区块正常显示、创建区块菜单可添加；
  - `src/client/plugin.tsx` 增加 `pluginSettingsManager.add('sjgl02')`——/admin/settings/sjgl02 可直接访问（v1 设置中心外壳），与 /v/admin/settings/sjgl02 双入口并存。

## 2.0.7（2026-07-26）

- **修复（任务/权限 Tab 切换误弹「当前配置未保存」）**：脏检查改为按 Tab 注册（`Record<tabKey, fn>`），仅在「离开脏向导 Tab」或「切回脏向导 Tab（旧实例将被重置）」时弹确认，任务管理/权限管理之间切换不再误弹；向导卸载时注销对应检查，同时修复闭包随 step 变化累积与 ExportWizard 闭包捕获过期 step 的问题。
- **杂项**：package.json 增加 `homepage`/`repository`（https://github.com/fengwenkai168/nocobase-plugin），README 增加主页链接。

## 2.0.6（2026-07-26）

- **修复（大文件下载无反应）**：任务文件下载由「fetch + blob 整文件读入内存」改为浏览器原生直链下载（`?token=` 鉴权，服务端本已流式输出），大体积导出包（如全部数据表 tar.gz）点击后立即开始流式下载并显示系统下载进度，不再长时间无反馈或内存溢出。涉及：任务列表「下载」、任务抽屉「下载导出文件 / 下载导入源文件 / 导出错误报告」。（注：token 入 URL 为需求方确认的取舍，服务请求日志会记录 query。）
- **新功能（导出全部数据表支持附件开关）**：「全部数据表（含系统表）」模式的配置面板新增「📎 导出附件」开关（此前仅单表模式有，服务端早已支持全表附件打包），开启后各表附件文件一并打包进 tar.gz。原型同步。

## 2.0.5（2026-07-26）

- **修复（1.0.x 旧版升级兼容）**：1.0.x 旧版使用蛇形表名（`sjgl02_permissions`/`sjgl02_tasks` 等 6 张），其索引名（如 `sjgl02_permissions_created_by_id`）与 2.0.x 驼峰表 sync 自动生成的索引同名（PostgreSQL 索引名 schema 内全局唯一），导致升级时报 `relation "..." already exists`。
  - 集合定义预声明自定义索引名（`idx_sjgl02perms_*`/`idx_sjgl02plogs_*`/`idx_sjgl02tasks_*`）：利用框架 `addIndex` 按字段去重机制，抑制默认蛇形名索引生成，sync 不再与旧表索引冲突；
  - 新增迁移 `20260725120000-drop-legacy-1x-tables`（`on='afterSync'`）：sync 完成后强制删除 6 张 1.0.x 旧表（不迁移数据），并清理 2.0.x 老库中被替换的旧命名索引；
  - 已验证：模拟 1.0.x 残留环境 `yarn nocobase upgrade` 通过、旧表全删、新表与索引正确；二次执行幂等。

## 2.0.4（2026-07-25）

- **修复（生产构建兼容）**：修复阻断全仓 `yarn build` 声明构建（dts）的 6 类 TypeScript 错误——`task-queue.ts` 插件类型引用路径（`./plugin`→`../plugin`）、`api.ts` 请求助手改泛型并补全调用点类型实参、`TaskRecord` 补 `permissionConfigId`/`permissionType` 字段、TaskDrawer 映射表列 render 参数显式类型与统计数值 Number 化、`export-engine.ts` 字段配置显式 `ExportFieldConfig[]`、`import-engine.ts` `filterByTk` 选项类型断言。修复后插件带声明构建通过、全仓生产构建（`yarn build`）通过，`yarn start` 生产模式启动验证正常（无需 pino/real-require 等额外配置，二者为核心包依赖由宿主提供）。

## 2.0.3（2026-07-25）

- **优化（Tab 切换重置）**：切回「导入」「导出」Tab 时重挂载向导，回到步骤 1 且清空全部配置状态（与任务管理/权限管理 Tab 的刷新行为一致）；脏数据离开确认逻辑不变。
- **优化（自动匹配改为三档名称匹配）**：
  - 100%：归一化（去空格/忽略大小写/全半角括号）后 Excel 列名 == 字段标题或字段标识；「标题(标识)」格式列名括号内 == 字段标识亦算 100%；
  - 80%：归一化后存在包含关系（列名包含标题/标识，或标题包含列名，长度≥2 防误配）；
  - 未匹配：保持「忽略」由用户手动选择（取消原纯顺序兜底分配，杜绝错配）；
  - 映射方式列新增匹配度标签（100% 绿 / 80% 橙），手动改动后消失；自动匹配后 toast 汇总各档数量。

## 2.0.2（2026-07-25）

- **优化（导入映射「忽略」状态的配置约束）**：字段映射为「忽略」时，「配置」列按钮/下拉禁用不可点（关联 ⚙️ 配置、附件选文件夹与配置均置灰）；行切换为「忽略」时自动收起配置面板并**清空该字段已填写的配置**（重新映射后恢复为默认值，防止隐藏配置残留生效）；「清空匹配」同步清空全部字段配置。原型 HTML 同步该交互。

## 2.0.1（2026-07-22）

- **新功能（导入：关联/附件字段级配置）**：
  - 字段映射表新增「配置」列：关联字段显示「⚙️ 配置」展开行内配置面板；附件字段三态（未上传压缩包提示 / 「📁 选文件夹」/ 文件夹名+配置按钮）。
  - 关联字段可配置：空值处理（跳过不更新/清空该字段解除关联）、匹配不到处理（该行导入失败/跳过该字段——多值任一匹配不到则整字段跳过）、更新模式（覆盖更新/追加更新，仅 update/upsert 且多值关联生效；多对一为单值直接替换）。
  - 附件字段可配置：压缩包内文件夹（取消字段名=文件夹名自动匹配约定，改为手动选择，必选）、空值处理（保留原附件/删除附件）、匹配不到处理（该行导入失败/跳过该附件——单文件跳过）、更新模式（覆盖/追加）。
  - 追加更新实现：update/upsert 命中已有记录时，服务端读取现有关联/附件合并去重后写入，不删除原有关联。
  - 删除全局「多对多关联字段 - 空值处理策略」面板（空值处理下沉为字段级配置），移除 `m2mStrategy` 参数。
  - 提交校验：已映射的附件字段未选择文件夹时，前端拦截「下一步」，服务端提交前二次校验。
  - 附件上传接口返回压缩包顶层文件夹清单（名称+文件数）；附件模板压缩包与说明文案同步更新。
  - 预览确认卡片「附件」显示各附件字段选中的文件夹。
- **原型同步**：`docs/sjgl02-prototype.html` 同步上述交互；修复原型预存 bug（`updateEmptyUniqueAlert` 局部变量遮蔽全局函数）。
- **测试**：4 轮浏览器端到端实测通过（默认严格回滚 / notFound 跳过该字段与跳过该附件 / 追加更新合并 / 覆盖更新与空值清空）。

## 2.0.0（2026-07-22）— 正式版

- **新功能**：Tab 切换自动刷新——切回「任务管理」「权限管理」Tab 时自动重载最新数据（组件按刷新键重挂载）；「导入」「导出」Tab 保持向导状态不受刷新影响（脏数据保护逻辑不变）。
- 版本定版 2.0.0：M1–M7 全部里程碑 + 83 条浏览器全量测试通过后的首个正式版本。

## 0.1.12（2026-07-22）

- **显示优化（任务详情/列表）**：
  - 详情抽屉「创建人」卡片改为两行显示：昵称 / 用户名；
  - 「导出字段」「字段映射详情」「唯一值字段」统一按「字段名称（字段标识）」格式显示（自动加载 collectionMeta 解析标题，如 `编码(code)`）；
  - 「导入模式」显示中文：新增(insert) / 更新(update) / 新增+更新(upsert)；
  - 任务列表「创建人」列显示昵称。
- **Bug 修复**：TaskRecord 创建人关系字段名与 API 不一致（creator → createdBy），修复列表/详情创建人长期显示 "-" 的问题。

## 0.1.11（2026-07-22）

- **Bug 修复**：权限管理「添加权限配置」选表时，自动隐藏当前用户/角色已配置过权限的数据表（每张表只能配置一次，避免重复配置触发唯一约束报错），并显示隐藏数量提示。
- **新功能**：导入/导出向导的「选择数据表」下拉支持关键字搜索，可同时匹配表名称与表标识（如搜"客户"或"customers"/"devPK"均可命中）。
- **新功能**：任务详情抽屉 KPI 区新增「数据量」卡片：完成态显示「导入/导出 N 条」（千分位），进行态显示「当前/总数」，排队态显示「-」。

## 0.1.10（2026-07-22）

- **修复下载未认证（EMPTY_TOKEN）**：任务列表「下载」、详情抽屉「下载导出文件/下载导入源文件/导出错误报告」、附件模板下载，由裸 `<a href>` 改为带 Authorization 头的 fetch + Blob 下载（自动还原中文文件名），修复点击下载提示"未认证"的问题。

## 0.1.9（2026-07-21）

- 设置页/区块顶部新增蓝色标题栏（还原原型设计）：左侧插件名与副标题「导入导出 · 任务管理 · 表级权限控制」，**右上角显示版本号徽章「数据管理-sjgl02 v<当前版本>」**（版本号取自 package.json，随版本递增自动更新）。

## 0.1.8（2026-07-21）— 测试准备 + 83 条浏览器全量测试通过

**测试覆盖**：《测试用例.md》83 条全部通过（Playwright 自动化）——§0 入口与通用 7、§1 导入 50（步骤一 6/步骤二 17/步骤三 4/执行结果 23）、§2 导出 15、§3 任务管理 14、§4 权限管理 13；另完成 M2/M3/附件 API 回归 42 断言无回归。50 万行导入 43s、100 万行导出 41s，性能达标。

**测试中发现并修复的 15 个产品缺陷**：

1. 权限管理：admin 执行导入/导出时可见全部用户/角色权限配置（ADR-019 落地，此前只查自己的）
2. admin 模拟用户权限导入时，数据 createdBy=权限拥有者（此前为操作人）
3. 任务/数据 createdById 为 NULL：context field 覆盖手动值，写操作统一显式传 context
4. 权限切换后映射表不为新增字段补行
5. 自动匹配不跳过已被占用的 Excel 列
6. 上传失败（格式不支持）无前端提示；API 客户端对 4xx 不 reject 导致错误静默（统一 unwrap errors）
7. 字符串型 Excel 日期序列号无法解析；非法日期（如 2026/13/45）被 JS 进位吞掉
8. 任务抽屉数据预览：导入任务 previewRows 为对象行导致 row.map 崩溃、抽屉打不开
9. 任务抽屉下载区：导入任务 fileName 为空导致源文件下载按钮不显示
10. 附件模板下载按钮无 download 属性不触发下载
11. resourcer 中间件 before:'acl' 时 ctx.auth 未就绪（统一改 after:'auth'，含 setScope 局部变量冲突修复）
12. 字段/集合标题 {{t("...")}} 模板未清理（field-meta、importableCollections、collectionMeta、permList 统一 cleanTitle）
13. collectionMeta 漏入 belongsTo/hasOne 的 foreignKey 属性列（ownerId 误当独立字段）
14. sjgl02:import 缺文件存在性校验导致未捕获异常（补友好 400）
15. i18n：补齐约 40 条中文硬编码（模式/字段类型/日期格式/操作符等），词条扩至 zh-CN/en-US 各 380+

**环境/测试基建**：demo 集合群（customers/products/orders/tags/departments/devPK/usersTags 中间表）+ 测试员A/数据导入员角色 + 菜单路由角色授权（roles.desktopRoutes:set）+ 50 万行/错误数据/附件包测试文件 + Playwright E2E 套件（/tmp/opencode/e2e/，含 helpers 与 t0-t4 五节脚本）。

## 0.1.7（2026-07-21）— M7 双入口与打磨

- v2 页面区块：`Sjgl02BlockModel`（直接继承 BlockModel，自动落入"其他区块"分类），区块名"数据管理02-sjgl02"，渲染导入/导出/任务管理 3 Tab（复用设置页组件，`showPermissionTab=false` 隐藏权限管理）。
- 区块实测（Playwright）：页面编辑 → 创建区块 → 其他区块 → 数据管理02-sjgl02 添加成功，3 Tab 渲染、任务管理数据加载正常、退出编辑模式后持久化展示。
- 全量 API 回归：M2 导入（12 断言）、M2 附件（9 断言）、M3 导出（21 断言）全部通过，无回归。
- 至此 M1–M7 全部里程碑完成：任务引擎 / 导入链路 / 导出链路 / 任务管理 / 双向导前端 / 权限管理 / 双入口。

## 0.1.6（2026-07-21）— M6 权限管理

- 权限 CRUD：sjgl02Permissions collection API + 写操作 ACL 守卫（仅 admin/root，resourcer 中间件 after:'auth'）。
- 权限操作日志 hook：beforeUpdate 捕获 `_previousDataValues` 旧值快照，afterCreate/afterUpdate/afterDestroy 自动写 sjgl02PermissionLogs（before/after 全量快照 + 智能 summary：新增/修改（定位到变更字段）/移除/开关切换）。
- 辅助接口：`permTargets`（用户+角色列表含角色摘要）、`permList`（自定义权限 + 按角色分组的继承权限，admin/root 角色特殊标记）。
- 前端 PermManager：左侧用户/角色栏（分组+搜索）、任务查看范围切换（用户维度 self/all）、admin/root 角色"全部权限"提示面板（7 项标签+隐藏添加按钮）、继承权限只读分组+查看详情弹窗、自定义权限卡片 CRUD（删除二次确认）、权限编辑弹窗（选表/双开关/模式 chips/唯一值（upsert 联动必填）/必填/可导入/可导出字段）、操作日志 Tab（类型+时间范围筛选/详情展开前后快照）。
- 修复：resourcer 中间件 before:'acl' 时 ctx.auth 未就绪导致 403（改 after:'auth'）；collection create body 双重包装 values；useApi 每渲染新建对象导致 useEffect 无限请求循环（useMemo 缓存）。
- i18n 新增约 80 条（zh-CN 350 / en-US 349）。
- 验证：API 级（CRUD+4 种日志类型快照与 summary）+ 浏览器级（新增/编辑/删除/日志 Tab/admin 角色面板/权限在 getImportPermissions 生效带白名单）全部通过。

## 0.1.5（2026-07-21）— M5 导入/导出前端向导

- 导入向导（3 步）：选表上传（权限过滤表清单 + 拖拽上传）、配置映射（Sheet/表头行/刷新/预览前10行、权限切换+摘要卡、导入模式锁定/切换、空白字段处理、多对多空值策略、唯一值 chips（锁定/自由/max3/空值预检警告）、字段映射表（Excel列占用置灰/自定义固定值/忽略/自动匹配/清空/计数/属性标签）、附件开关+tar.gz 上传+模板下载、系统字段规则折叠面板）、预览执行（确认卡片 + 换行表头预览表 + 确认弹窗 + 防重复提交 + 完成后重置）。
- 导出向导（3 步）：选表（admin 可见"全部数据表"）、字段配置（常规/日期时间（逐字段格式）/关联（逐字段导出值）/附件四分组 + 全选计数 + 权限白名单置灰、关联表导出模式（chips 多选 + Sheet/独立文件）、表头格式三选、数据范围（全部/AND 条件组）、高级选项、全部表模式全局日期/关联格式）、执行确认（确认卡片 + 选中字段标签墙 + 文件名预览 + 确认弹窗）。
- 脏数据保护：步骤二有修改时切步骤/切 Tab/关页面前弹确认（beforeunload 兜底）；提交防重复点击。
- 服务端新增 `sjgl02:collectionMeta`（字段元数据：类型/选项/关联目标/主键）；修复 GET 接口参数合并（values 空对象遮蔽 query 参数）；field-meta 排除 belongsTo/hasOne 的 foreignKey 属性列（ownerId 不再误当独立字段）。
- i18n：新增约 190 条中英词条（zh-CN 271 / en-US 270）。
- 浏览器端到端实测（Playwright）：导入向导全链路（选表→拖拽上传→配置→预览→执行→任务#60 succeeded 15 行）、导出向导全链路（选表→字段配置→确认→执行→任务#61 succeeded 文件生成）全部通过。

## 0.1.4（2026-07-21）— M4 任务管理

- 任务接口：`stats`（状态聚合统计）、`download`（导出文件/导入源文件，流式 + RFC5987 中文文件名）、`exportErrorReport`（CSV，BOM + withoutDataWrapping）、`retry`（按 params 快照重建任务）、`getScope`/`setScope`（任务查看范围）。
- 新增 `sjgl02UserSettings` 表（userId 唯一 + taskScope）；任务列表/详情按查看范围过滤（resourcer 中间件，非"查看全部"用户仅见自己任务；下载/错误报告同鉴权）。
- 前端 TaskCenter（client-v2）：设置页注册（`/v/admin/settings/sjgl02`，4 Tab 容器），统计卡 6 张（点击快捷过滤）、类型/状态/关键词筛选、任务表格（进度条/操作列）、详情抽屉（KPI 网格/配置斑马纹/字段映射/导出字段/数据预览/失败明细分页加载/下载区）、进行中任务抽屉 2s 轮询、列表 5s 轮询、取消（回滚提示）/重新导出。
- i18n：zh-CN/en-US 词条 60+（locale.ts tExpr/useT 绑定插件命名空间）。
- 浏览器实测（Playwright）：设置菜单/统计卡/筛选/表格/抽屉/进行中轮询/列表取消/抽屉取消（57% 处取消成功）/启动恢复"服务重启中断"全部通过。
- 环境：Alpine 容器安装 Playwright Chromium（gcompat + libatk 等依赖）用于浏览器自动化测试。

## 0.1.3（2026-07-21）— M3 导出链路

- 新增导出 API：`getExportPermissions`、`exportableCollections`（含 isAdmin 标记）、`export`（exportFilter 后端强制合并、字段白名单校验、全部表模式仅 admin/root）。
- 导出引擎：游标分页查询（每批 1000）+ exceljs WorkbookWriter 流式写入，内存恒定；单文件超 100 万行自动分新文件（part-N）。
- 字段格式化：日期 8 种格式（含时间戳/Excel 友好格式）、单选导出标签、布尔导出 是/否、多选逗号拼接、关联值三模式（显示值/主键值/显示值+主键值）、i18n 模板标题清理（{{t("...")}}）。
- 关联表导出：单独 Sheet（同工作簿，多分文件时落独立"关联表.xlsx"）或独立 xlsx 文件；m2o 导出被引用记录（目标表标量字段），m2m/o2m 导出中间表映射对（源主键/目标主键/显示字段）；Sheet 命名 `主表字段名称(标识)-关联表名称(标识)`（31 字符截断）。
- 附件导出：按 `attachments/<字段标识>/<标题.扩展名>` 打包 tar.gz（重名加 id 前缀）。
- 全部数据表模式（admin/root）：遍历全部集合逐表独立 xlsx + 导出清单.json，打包 `全部数据表-时间戳.tar.gz`。
- 文件命名：`数据表名称-数据表标识-年月日时分秒.xlsx`；多文件/含附件自动打 tar.gz；任务记录写入 filePath/fileName/fileSize。
- API 自验 8 用例全部通过（基础格式/关联 Sheet/筛选/附件打包/全部表 90 张/表头与格式变体/权限/关联独立文件）。
- 排障：tar-stream 3.x `pack.entry(header, cb)` 返回可写流需 source.pipe(entry)，误用 v1 API（stream 作参数）导致打包死锁。

## 0.1.2（2026-07-21）— M2 导入链路

- 新增导入 API（`sjgl02` 自定义资源）：`importUpload`（koaMulter 上传 Excel/附件包，返回 sheet 列表）、`previewExcel`（前 10 行预览）、`getImportPermissions`、`importableCollections`（按权限过滤可导入表）、`import`（行数/模式/白名单/唯一值校验后创建任务）、`downloadTemplate`（附件包模板）。
- Excel 解析服务：xlsx 走 exceljs WorkbookReader 流式（带竞态重试），xls/csv 走 SheetJS；行数上限 xlsx/csv 50 万、xls 20 万（提交预检 + 引擎内兜底）。
- 值转换服务（规则表 4.1.8 全量）：文本/整数/数字/单选（标签匹配）/多选/布尔（6 种写法）/日期（7 种格式含 Excel 序列号）/m2o/o2m/m2m（主键关联+存在性校验缓存）/系统字段 Excel 映射优先/子表与公式忽略。
- 导入引擎：流式单事务（批量 500 bulkCreate 快路径 + 关联行 repo 逐行），insert/update/upsert，唯一值组合匹配，空值唯一值预检，手动主键校验，批次内主键查重，任何行失败整批回滚，错误明细（行号/字段/原因/原始值）入任务 result。
- 附件导入：tar.gz 按 `attachments/<字段标识>/<文件名>` 解包，提交前校验文件存在性与扩展名黑名单（缺失即回滚），数据提交后异步建附件记录（local 存储）并关联。
- 权限服务：用户/角色权限查询、admin/root 全权限合成、导入参数白名单断言。
- API 自验 14 个用例全部通过（insert/错误回滚/upsert/空唯一值/update 保留原值/权限拒绝/附件正常+缺失回滚+未传包回滚）。

## 0.1.1（2026-07-20）— M1 骨架与数据模型

- `yarn pm create` 生成标准脚手架并与既有文档/元数据合并（src/server、src/client-v2、src/locale、入口 shim）。
- 新增 3 张 collections：`sjgl02Tasks`（任务表）、`sjgl02Permissions`（权限配置表，含 targetType+targetId+collectionName 唯一索引）、`sjgl02PermissionLogs`（操作日志表），json 字段统一 jsonb。
- 任务引擎定稿实现：`app.eventQueue` 进程内调度（串行并发 1）+ AbortController 取消 + 进度节流写库（500ms）；启动恢复（afterStart 将残留 pending/running 标记 failed"服务重启中断"）。
- ACL：注册 4 个 snippet（`pm.sjgl02.import/export/tasks/permission`），M1 阶段任务接口先放开 loggedIn。
- 自验通过：demo 任务提交→进度 15/15→succeeded；running 中取消→canceled（回滚提示）；`yarn nocobase upgrade` 同步 3 表 14 索引成功。
- 清理旧版废弃实现遗留的 3 张孤儿表（sjgl02_tasks / sjgl02_permissions / sjgl02_table_permissions，用户授权 DROP）。
- 已知环境事项：本仓库核心包 lib 类型产物缺失，插件构建使用 `yarn build @my-project/plugin-sjgl02 --no-dts`。

## 0.1.0（2026-07-20）

- 完成产品定义与技术方案定稿：基于交互原型 v2.0.0 重写《开发文档.md》，作为开发唯一依据。
- 文档体系重构：历史文档（dev-plan / final-spec / spike-results / 技术决策记录等 10+ 份）全部归档至 `docs/archive/`。
- 关键技术裁决：
  - 任务队列定稿为 **DB 任务表 + app.eventQueue 进程内调度 + AbortController 取消**（无降级方案；ioredis-mock 为测试模拟库，带入生产有运行时风险，一次性否掉）；
  - 导入行数上限 xlsx/csv ≤ 50 万行、xls ≤ 20 万行；导出不设上限、百万行自动分表；
  - 严格模式单大事务，失败/取消整批回滚；
  - 双入口：插件设置页（4 Tab）+ v2 页面区块（3 Tab）。
- 声明依赖：`exceljs`、`tar-stream`（不引入 bull / ioredis-mock，零新增队列依赖，生产环境装上即用）。
