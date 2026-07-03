# CHANGELOG

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
