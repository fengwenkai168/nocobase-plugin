# @my-project/plugin-sjgl02 — 数据管理插件

NocoBase 全栈插件，提供 **Excel 导入、导出、任务管理、表级权限控制、审计日志** 五大功能模块。

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.139 |
| 兼容 | NocoBase 2.x |
| 核心入口 | 设置 → 数据管理（v1: `/admin/settings/sjgl02` / v2: `/v2/admin/settings/sjgl02`） |
| 区块入口 | v2 页面 → 添加区块 → 其他 → 数据管理 |
| 运行时依赖 | exceljs ^4.4.0（流式解析+写入）、async-mutex ^0.4.0（防重入）、archiver ^6.0.0（ZIP打包） |
| 国际化 | zh-CN / en-US，共 115 个翻译键 |
| 默认状态 | 默认关闭，需手动启用 |

---

## 1. 目录结构

```
plugin-sjgl02/
├── package.json                                  # 插件元数据（@my-project/plugin-sjgl02）
├── server.js / client.js / client-v2.js          # NocoBase 框架运行时 shim
├── src/
│   ├── index.ts                                  # 根入口 → export { default } from './server'
│   ├── server/
│   │   ├── index.ts                              # 服务端入口
│   │   ├── plugin.ts                             # 插件主类 PluginSjgl02Server
│   │   ├── collections/
│   │   │   ├── sjgl02_tasks.ts                   # 导入导出任务表
│   │   │   ├── sjgl02_table_permissions.ts       # 表级权限配置表
│   │   │   ├── sjgl02_settings.ts               # 全局/用户设置表
│   │   │   ├── sjgl02_permission_logs.ts         # 权限操作审计日志表
│   │   │   └── sjgl02_task_logs.ts               # 任务执行日志表
│   │   ├── actions/
│   │   │   ├── import.ts                         # 导入端点（三阶段流式+影子表）
│   │   │   ├── export.ts                         # 导出端点（游标分页+合并扫描）
│   │   │   ├── tasks.ts                          # 任务管理端点（含 cancelFlags）
│   │   │   ├── permissions.ts                    # 权限管理端点（~226 行）
│   │   │   ├── permission-check.ts               # 权限强制校验工具（~153 行）
│   │   │   ├── taskLogs.ts                       # 任务日志读写（~25 行）
│   │   │   └── cancel-state.ts                   # 内存级取消标志（Set<number>）
│   │   └── migrations/
│   │       ├── 20260702160000-add-task-file-name.ts   # file_name 列添加
│   │       └── 20260702170000-backfill-file-name.ts   # 旧数据 fileName 回填
│   ├── client/
│   │   ├── index.ts                              # v1 客户端入口
│   │   ├── plugin.tsx                            # v1 客户端注册（设置页+区块+SchemaSettings）
│   │   └── panels/
│   │       ├── shared.ts                         # VERSION 常量 + apiRequest 工具函数
│   │       ├── ImportPanel.tsx                   # 导入向导面板（3 步）
│   │       ├── ExportPanel.tsx                   # 导出向导面板（3 步）
│   │       ├── TaskPanel.tsx                     # 任务管理面板（列表+详情抽屉）
│   │       ├── PermissionPanel.tsx               # 权限管理面板（左侧列表+右侧卡片）
│   │       ├── Sjgl02Block.tsx                   # v1 页面区块组件
│   │       ├── Sjgl02BlockInitializer.tsx        # v1 区块添加菜单注册
│   │       └── task/
│   │           ├── shared.tsx                    # 状态配色/工具函数
│   │           ├── TaskList.tsx                  # 任务列表（筛选+搜索+轮询）
│   │           ├── TaskDetail.tsx                # 任务详情 Drawer（1024px）
│   │           ├── TaskCards.tsx                 # 7 张信息卡片
│   │           └── ExecutionLogViewer.tsx        # 终端风格日志查看器
│   ├── client-v2/
│   │   ├── index.tsx                             # v2 客户端入口
│   │   ├── plugin.tsx                            # v2 客户端注册（菜单+懒加载+BlockModel）
│   │   ├── locale.ts                             # i18n 命名空间
│   │   ├── models/
│   │   │   └── SjglBlockModel.tsx                # v2 区块模型（lazy 加载3个Tab面板）
│   │   ├── pages/
│   │   │   ├── Sjgl02SettingsPage.tsx            # v2 设置主页（LazyTab 懒加载）
│   │   │   └── PermissionTab.tsx                 # v2 权限管理 Tab（使用共享 hooks）
│   │   ├── hooks/
│   │   │   ├── index.ts                          # 桶导出
│   │   │   ├── usePermissions.ts                 # 权限 CRUD hook
│   │   │   ├── usePermissionFilter.ts            # 权限搜索过滤+分页
│   │   │   ├── useTablePermission.ts             # 表级导入权限查询（用户级>角色级）
│   │   │   ├── useTargetList.ts                  # 用户/角色列表加载
│   │   │   ├── useTableList.ts                   # 数据表列表加载
│   │   │   ├── useTableFields.ts                 # 表字段按需加载
│   │   │   └── useViewScope.ts                   # 任务查看范围读写
│   │   ├── types/
│   │   │   └── permission.ts                     # 类型定义
│   │   └── utils/
│   │       └── api.ts                            # 统一 useAPI() hook（兼容 v1/v2）
│   └── locale/
│       ├── zh-CN.json                            # 中文翻译（115 键）
│       └── en-US.json                            # 英文翻译（115 键）
├── dist/                                         # 编译产物
├── README.md                                     # 本文件
└── CHANGELOG.md                                  # 完整变更日志
```

---

## 2. 功能概述

| # | 模块 | 核心功能 |
|---|------|----------|
| 1 | 导入 | 3 步向导（选表→上传+字段映射→预览+执行），支持 xlsx/xls/csv，事务回滚 |
| 2 | 导出 | 3 步向导（选表→字段配置→执行+下载），流式写入无行数上限，支持单表/全表/含附件 |
| 3 | 任务管理 | 任务列表（筛选/搜索/轮询）+ 详情 Drawer（7张卡片+终端日志），取消任务 |
| 4 | 权限管理 | 用户/角色维度表级权限 + 字段级白名单 + 导入模式限制 + 审计日志（操作记录） |
| 5 | 全局设置 | 任务查看范围（自己/全部）、文件大小上限、批处理大小 |

### 两个入口

| 入口 | 路由 | 包含模块 |
|------|------|----------|
| 设置菜单（v1/v2） | v1: `/admin/settings/sjgl02` / v2: `/v2/admin/settings/sjgl02` | 导入、导出、任务管理、权限管理（含操作日志） |
| 页面区块 | v2 页面 → 添加区块 → 其他 → 数据管理 | 导入、导出、任务管理（不含权限管理） |

---

## 3. 导入功能

### 3.1 3 步向导流程

**Step 1 — 选择数据表**
- 下拉选择器动态加载所有有导入权限的数据表
- 支持搜索过滤，右侧显示导入说明

**Step 2 — 上传文件 & 字段映射**
- 通过 `attachments:create` 标准 API 上传，支持拖拽，限制最大 50MB
- 上传后自动调用 `uploadParse` 解析，显示：
  - Sheet 选择器（多 Sheet 文件，仅 1 个 Sheet 时禁用）
  - 表头行号选择（1-100，默认 1）
  - 「预览表头」按钮（弹框显示表头列 + 前 10 行数据）
  - 导入模式选择：新增 / 更新 / 新增+更新（受权限限制）
  - update/upsert 模式强制要求选择「唯一值字段」
  - 空白单元格处理：按Excel值更新 / 按NULL更新 / 跳过
- 字段映射表：
  - 3 列结构：Excel 列（下拉） → 映射方式（只读标签） → 工作表字段（下拉）
  - 自动匹配（5 种规则）：精确匹配 / 标题匹配 / 括号提取 / 包含匹配 / 标题包含
  - 去重联动：已选的 Excel 列在后续行自动禁用
  - 「清空」按钮一键清除所有映射
  - 必填字段标注红色 ⚠ 标签
  - 标题栏统计：已映射/忽略/未映射数量
- admin/root 可切换「模拟权限方案」下拉，预览不同权限下导入效果

**Step 3 — 预览 & 执行**
- 统计摘要卡片：预计行数 / 错误行数 / 导入模式 / Sheet 名
- update/upsert 显示唯一值匹配提示
- 预览数据表（前 10 行）
- 确认弹窗后提交任务

### 3.2 服务端导入规则

- **事务回滚**：任何数据行失败 → 整个任务全部回滚，不写入任何数据
- **空值唯一值预检**：update/upsert 模式下，任意行唯一值字段为空 → 整批回滚
- **批次处理**：阶段二影子表批量写入 + 阶段三 `repo.create()` 分批创建（5000 行/批）
- **系统字段自动填充**：未映射 `createdById` / `updatedById` / `createdAt` / `updatedAt` 时，自动写入导入任务创建人和当前时间
- **主键支持**：兼容 Snowflake ID (53-bit)、UUID、Nano ID、自增整数等全部 NocoBase 预置主键类型；Excel 未映射主键时自动由系统生成
- **主键冲突校验**：Excel 中填写主键时，阶段一检测内部重复，阶段三检测与数据库已有记录冲突
- **字段级权限**：校验映射字段是否在 `importFields` 白名单内
- **导入模式校验**：校验请求 importMode 是否在权限允许列表内
- **必填字段校验**：必须至少 1 个且全部已映射
- **日期自动转换**：ISO 格式 → `YYYY-MM-DD HH:mm:ss`
- **关联字段映射**：belongsTo 外键通过 `applyBelongsToFK` 查目标表获取 ID
- **同批次去重**：update/upsert 模式下同批次唯一值去重检测

### 3.3 导入端点（4 个）

| 端点 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `sjgl02Import:tableFields` | GET | `?tableName=` | `{ name, title, type, interface, isRequired, target }` | 获取目标表字段列表 |
| `sjgl02Import:uploadParse` | POST | `{ fileId, sheetName?, headerRow? }` | `{ sheets, headerColumns, previewRows, totalRows, fileName }` | 解析 Excel 文件 |
| `sjgl02Import:preview` | GET | `?fileId=&sheetName=&headerRow=&previewLimit=` | `[{ rows }]` | 获取前 N 行预览数据 |
| `sjgl02Import:execute` | POST | `{ tableName, fileId, sheetName, headerRow, fieldMapping, customValues, importMode, uniqueFields, blankCellMode, permSource? }` | `{ taskId }` | 提交导入任务并开始执行 |

---

## 4. 导出功能

### 4.1 3 步向导流程

**Step 1 — 选择数据表**
- 下拉首选项「全部数据表（含系统表）」，仅 admin/root 可见
- 非 admin/root 只显示有导出权限的单表

**Step 2 — 配置（单表 / 全表）**

单表模式配置项：

| 配置项 | 说明 |
|--------|------|
| 字段选择 | 复选框分组：常规 / 关联（紫色） / 附件（青色），全选 + 已选计数 |
| 关联字段显示 | 每个关联字段可选「显示值(Display)」/「仅ID(ID only)」 |
| 关联数据 Sheet | Switch 开关，开启后关联表数据单独建 Sheet |
| 高级选项 | 文件名模板（`{表名}_{日期}.xlsx`，支持 `{表名}` `{日期}` 占位符）、包含附件文件、表头格式（字段名(字段标识) / 字段名 / 字段标识） |

全表模式：
- 蓝色警告提示将导出全部表
- 标签列表显示所有导出表名，含附件标注
- 最终打包为 ZIP

**Step 3 — 执行导出**
- 统计卡片 + 已选字段标签列表
- 提交后 2 秒轮询实时进度
- 完成后显示下载按钮

### 4.2 服务端导出规则

- **流式写入**：`ExcelJS.stream.xlsx.WorkbookWriter`，分页查询（5000 行/批），无行数上限
- **关联字段取值**：belongsTo/hasOne 取值链 `nickname || username || name || email || id`
- **关联 Sheet**：遍历 belongsTo/hasOne/hasMany/belongsToMany，单独建 Sheet
- **附件打包**：扫描 attachment 字段，收集文件路径，用 archiver 打包 ZIP
- **全表模式**：逐表检查 export 权限，无权限的表自动跳过
- **字段级过滤**：校验 selectedFields 是否在 `exportFields` 白名单内
- **互斥锁**：`async-mutex` 防止并发导出
- **多文件合并**：多表导出生成多个文件 → archiver 打包为单一 ZIP

### 4.3 文件格式

| 场景 | 格式 |
|------|------|
| 单表 + 无附件 | .xlsx（Excel 流式文件） |
| 单表 + 含附件 | .zip（Excel + 按字段分文件夹存放附件） |
| 全部数据表 | .zip（每表一个 Excel + 附件） |

### 4.4 导出端点（5 个）

| 端点 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `sjgl02Export:tableFields` | GET | `?tableName=` | `{ name, title, type, interface, target }` | 获取表字段列表 |
| `sjgl02Export:previewCount` | POST | `{ tableName, filter }` | `{ count }` | 预估导出行数 |
| `sjgl02Export:execute` | POST | `{ tableName, selectedFields, associationDisplayMode, includeAssociationSheet, associationSheetTables, filter, fileNameTemplate, includeAttachments, headerStyle }` | `{ taskId }` | 提交导出任务并开始执行 |
| `sjgl02Export:progress` | GET | `?taskId=` | `{ progress, status, exportFileId }` | 实时查询导出进度 |
| `sjgl02Export:download` | GET | `?taskId=` | 文件流（`Content-Disposition: attachment`） | 下载导出文件 |

---

## 5. 任务管理

### 5.1 任务列表

| 筛选 | 选项 |
|------|------|
| 任务类型 | 全部 / 导入 / 导出 |
| 状态 | 全部 / 排队中 / 进行中 / 已完成 / 失败 / 已取消 |
| 搜索 | 支持按任务ID / 文件名 / 表名 / 创建用户搜索 |

| 列 | 说明 |
|----|------|
| 任务ID | `#1001` 格式 |
| 类型 | 导入（蓝色标签）/ 导出（绿色标签） |
| 目标表 | 表名称（表标识），`__all__` 显示为"全部数据表" |
| 状态 | 排队中（橙色）/ 进行中（蓝色）/ 已完成（绿色）/ 失败（红色）/ 已取消（灰色） |
| 进度 | 进度条 + 百分比 |
| 数据量 | 已处理 / 总数 |
| 创建人 | 用户名（nickname / username / name 三层兜底） |
| 创建时间 | 日期时间 |
| 完成时间 | 日期时间，未完成显示 — |
| 操作 | 「查看」打开详情 Drawer / 「取消」（仅 pending/processing 状态可见） |

- 轮询刷新：进行中的任务每 2 秒自动刷新
- 任务查看范围：admin/root 始终可查看全部，其他用户按 `sjgl02_settings.taskViewScope` 配置（用户级 > 全局级，默认 `own`）

### 5.2 任务详情 Drawer（1024px）

加载 7 张信息卡片：

| # | 卡片 | 内容 |
|---|------|------|
| 1 | 任务摘要 | ID、类型、目标表、创建人、时间、文件名、状态、数据量、完成于/上传于 |
| 2 | 导出字段 | 所选字段标签列表（主表字段 / 关联表字段 Tabs） |
| 3 | 关联表 | 关联 Sheet 详情（Sheet名 / 关联表 / 关联字段 / 数据量） |
| 4 | 导入配置 | 导入模式、唯一值字段、必填字段、空白单元格处理模式 |
| 5 | 字段映射 | 导入的字段映射表（Excel列 → 映射方式 → 工作表字段），含自定义值 |
| 6 | 数据预览 | 前 5-10 行数据表格；失败任务显示错误行号+原因+字段快照 |
| 7 | 执行日志 | 终端风格深色背景（#1e293b），按级别着色（INFO/SUCC/WARN/ERROR），可折叠+自动刷新 |

### 5.3 任务管理端点（3 个）

| 端点 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `sjgl02Tasks:list` | GET | `?taskType=&status=&search=&page=&pageSize=` | `{ items, total, page, pageSize }` | 分页列表（含 createdBy） |
| `sjgl02Tasks:detail` | GET | `?taskId=` | 任务完整对象（含 createdBy） | 任务详情 |
| `sjgl02Tasks:cancel` | POST | `{ taskId }` | `{ success: true }` | 取消任务（仅 pending/processing） |

### 5.4 任务日志端点（1 个）

| 端点 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `sjgl02TaskLogs:list` | GET | `?taskId=&page=&pageSize=` | `{ items, total, page, pageSize }` | 分页查询执行日志（默认 100 条/页） |

---

## 6. 权限管理

### 6.1 权限架构

```
权限优先级：用户级权限 > 角色级权限 > 拒绝
             ↑                ↑
         canImport=false    多角色取最宽松
         → 直接拒绝        （canImport=true优先）
                            importMode 合并去重
```

- **admin/root 角色短路**：直接返回全权限（三种导入模式全部可用，所有字段开放），不查询数据库
- **用户级优先**：存在用户级权限时，直接使用用户级权限，不再查找角色权限
- **角色级最宽松**：用户有多个角色时，`canImport=true` 优先，`importMode` 合并去重
- **_inherited 标记**：通过 `toJSON()` 转纯对象后设置属性（Sequelize 模型实例上直接设置会丢失）
- **_systemManaged 标记**：admin/root 角色自动补齐的权限标记为 `_systemManaged=true`，不可编辑/删除

### 6.2 权限字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `canImport` | boolean | 是否允许导入 |
| `canExport` | boolean | 是否允许导出 |
| `importMode` | json(数组) | 允许的导入模式（insert/update/upsert 自由组合） |
| `importFields` | json(数组) | 可导入字段白名单（空=全部） |
| `exportFields` | json(数组) | 可导出字段白名单（空=全部） |
| `uniqueFields` | json(数组) | 唯一值字段列表 |
| `requiredFields` | json(数组) | 必填字段列表 |

### 6.3 权限面板 UI

**左侧栏（span=6）**：用户列表（蓝色头像）+ 角色列表（绿色头像），搜索过滤，点击切换

**右侧主体（span=18）**：
- 头部：目标名称标签（格式「名称(标识)」）
- 子Tab：[✓ 权限配置] / [📋 操作日志]
- 权限分区：「自定义权限」（橙色 ✏️ 标签）、「继承权限」（紫色 📦 标签），支持收起/展开
- 自定义权限卡片：表名 + 标签行（导入/导出/模式/唯一值/必填/可导入数/可导出数）+ 编辑/删除按钮
- 继承权限卡片：表名 + 标签行 + 「查看详情」只读弹窗
- 系统管理权限（admin/root）：蓝色「系统管理」标签，不可编辑/删除
- 批量操作：全选 + 批量删除（Popconfirm 确认）
- 继承权限内按 `tableName` 去重（多角色同表权限只显示一条）

### 6.4 权限编辑弹窗（Modal 720px）

| 字段 | 类型 | 说明 |
|------|------|------|
| 选择数据表 | 下拉搜索 | 必填，过滤已有自定义权限的表（继承的允许覆盖） |
| 允许导入/导出 | Switch | 分别控制下方配置区显隐 |
| 导入模式 | 多选 | 新增 / 更新 / 新增+更新 |
| 唯一值字段 | 多选 | 仅当导入模式含 update/upsert 时必填 |
| 必填字段 | 多选 | — |
| 可导入字段 | 多选 | 空=全部允许 |
| 可导出字段 | 多选 | 空=全部允许 |

### 6.5 审计日志

`sjgl02_permission_logs` 表自动记录每次权限变更：

| 字段 | 说明 |
|------|------|
| `action` | create / update / delete / toggle |
| `targetType` / `targetId` / `targetName` | 目标信息 |
| `tableName` | 被变更的数据表 |
| `changes` | 变更前后快照（JSON） |
| `operatorId` | 操作人 |
| `createdAt` | 操作时间 |

### 6.6 权限管理端点（5 个）

| 端点 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|
| `sjgl02Permissions:userRoleList` | GET | — | `{ users: [], roles: [] }` | 获取用户+角色列表（用户含关联角色） |
| `sjgl02Permissions:tables` | GET | — | `[{ name, title }]` | 获取所有数据表（排除 through 表） |
| `sjgl02Permissions:get` | GET | `?targetType=&targetId=` | `{ custom: [], inherited: [] }` | 获取某用户/角色的权限（含继承） |
| `sjgl02Permissions:save` | POST | `{ permissions: [] }` | `{ success: true }` | 全量保存权限（upsert+删除+审计） |
| `sjgl02Permissions:settings` | GET | `?userId=` | 设置对象 | 获取全局/用户设置（无副作用） |
| `sjgl02Permissions:saveSettings` | POST | `{ taskViewScope?, userId? }` | `{ success: true }` | 保存全局/用户设置 |

---

## 7. 数据模型

### 7.1 sjgl02_tasks（导入导出任务）

| 字段 | 类型 | 默认值 | 约束 | 说明 |
|------|------|--------|------|------|
| id | integer | 自增 | PK | 任务ID |
| taskType | string | import | select | import / export |
| tableName | string | — | — | 目标表名（`__all__` 表示全表导出） |
| fileName | string | — | — | 上传/导出文件名 |
| status | string | pending | select | pending / processing / completed / failed / cancelled |
| fieldMapping | json | — | — | 导入字段映射配置 |
| customValues | json | — | — | 导入固定值配置 |
| selectedFields | json | — | — | 导出选中字段列表 |
| errorLogs | json | — | — | 失败行错误日志数组 |
| progress | integer | 0 | — | 进度百分比（0-100） |
| totalRows | integer | 0 | — | 总行数 |
| processedRows | integer | 0 | — | 已处理行数 |
| importMode | string | insert | select | insert / update / upsert |
| sheetName | string | — | — | Excel Sheet 名称 |
| headerRow | integer | 1 | — | 表头行号（1-100） |
| uniqueFields | json | — | — | 唯一值字段列表 |
| importFileId | integer | — | — | 导入源文件附件 ID |
| exportFileId | integer | — | — | 导出文件附件 ID |
| errorMessage | text | — | — | 失败错误信息 |
| includeAssociationSheet | boolean | false | — | 是否包含关联 Sheet |
| includeAttachments | boolean | false | — | 是否包含附件文件 |
| associationSheetTables | json | — | — | 关联表列表 |
| associationDisplayMode | json | — | — | 关联字段显示模式 |
| blankCellMode | string | update | — | 空白单元格处理（update / null / skip） |
| headerStyle | string | title_id | — | 表头格式（title_id / title / id） |
| completedAt | date | — | — | 完成时间 |
| createdById | integer | — | FK→users | 创建人 |

### 7.2 sjgl02_table_permissions（表级权限配置）

| 字段 | 类型 | 默认值 | 约束 | 说明 |
|------|------|--------|------|------|
| id | integer | 自增 | PK | — |
| targetType | string | — | select | user / role |
| targetId | string | — | — | 用户ID（字符串）或角色 name |
| targetName | string | — | — | 冗余名称 |
| tableName | string | — | — | 数据表名 |
| canImport | boolean | false | — | 允许导入 |
| canExport | boolean | false | — | 允许导出 |
| importMode | json | `['insert','update','upsert']` | — | 允许的导入模式数组 |
| uniqueFields | json | — | — | 唯一值字段列表 |
| requiredFields | json | — | — | 必填字段列表 |
| importFields | json | — | — | 可导入字段白名单（空=全部） |
| exportFields | json | — | — | 可导出字段白名单（空=全部） |
| permissions | json | — | — | 扩展权限 JSON |
| priority | integer | 0 | — | 优先级 |
| createdById | integer | — | FK→users | 创建人 |
| createdAt | date | — | — | 创建时间（自动） |
| updatedAt | date | — | — | 更新时间（自动） |

**唯一索引**：`UNIQUE(targetType, targetId, tableName)` — 名称 `sjgl02_perms_unique_target_table`

### 7.3 sjgl02_settings（全局/用户设置）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | bigint | 自增 | PK |
| taskViewScope | string | own | 任务查看范围（own / all） |
| maxFileSize | integer | 50 | 最大文件大小（MB） |
| batchSize | integer | 1000 | 批处理大小 |
| userId | bigInt | null | 用户ID（null=全局默认） |

**索引**：`userId`

### 7.4 sjgl02_permission_logs（权限操作日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| action | string(select) | create / update / delete / toggle |
| targetType | string | 用户/角色 |
| targetId | string | 目标ID |
| targetName | string | 目标名称 |
| tableName | string | 被操作的数据表 |
| changes | json | 变更前后快照 |
| operatorId | integer | 操作人（FK→users） |
| createdAt | date | 操作时间 |

**索引**：`(targetType, targetId)`、`(createdAt)`

### 7.5 sjgl02_task_logs（任务执行日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer | PK |
| taskId | integer | 关联任务ID（FK→sjgl02_tasks） |
| level | string(select) | INFO / SUCC / WARN / ERROR |
| message | text | 日志内容 |
| timestamp | date | 时间戳 |

**索引**：`(taskId)`、`(timestamp)`

---

## 8. 权限检查逻辑（permission-check.ts）

### 8.1 检查优先级

```
checkTablePermission(tableName, actionType, permSource?)
  ├── 未登录 → 401
  ├── permSource 指定 → 使用指定用户/角色的权限（admin/root 模拟方案功能）
  ├── admin/root 角色 → 返回全权限（短路，跳过所有 DB 查询）
  ├── 用户级权限存在 → 使用用户级权限
  │   └── canImport/canExport=false → 403 拒绝
  ├── 角色级权限存在（多角色取最宽松）→ 使用角色级权限
  │   └── canImport/canExport=false → 403 拒绝
  └── 都不存在 → 403 拒绝
```

### 8.2 返回结构 `TablePermission`

```typescript
{
  canImport: boolean;
  canExport: boolean;
  importMode: string[];        // 允许的导入模式
  importFields: string[];      // 可导入字段白名单（空=全部）
  exportFields: string[];      // 可导出字段白名单（空=全部）
  uniqueFields: string[];      // 唯一值字段
  requiredFields: string[];    // 必填字段
}
```

---

## 9. 全局配置（sjgl02_settings）

| 配置项 | 范围 | 默认值 | 说明 |
|--------|------|--------|------|
| taskViewScope | 用户级 > 全局 | own | own=仅看自己的任务 / all=查看全部任务 |
| maxFileSize | 全局 | 50 | 上传文件大小上限（MB），前端校验 |
| batchSize | 全局 | 1000 | 导入批次大小 |

- admin/root 角色始终为 `taskViewScope='all'`
- 用户级设置（`userId` 不为 null）优先级高于全局设置（`userId` 为 null）
- GET 请求无副作用（查不到返回默认值，不自动创建记录）

---

## 10. 安装与使用

### 10.1 安装依赖

```bash
cd nocobase-2.1.9
yarn install
```

### 10.2 构建与启用

```bash
# 构建插件
yarn build

# 启用插件（install() 自动创建默认设置 + admin/root 全表权限）
yarn nocobase pm enable @my-project/plugin-sjgl02

# 数据库升级（自动运行 migrations）
yarn nocobase upgrade
```

### 10.3 开发模式

```bash
yarn dev
```

### 10.4 访问

```
http://localhost:13000 → 登录（nocobase / admin123）→ 设置 → 数据管理
```

---

## 11. 技术实现要点

| 要点 | 说明 |
|------|------|
| **双客户端** | v1（`@nocobase/client`）+ v2（`@nocobase/client-v2`）。v1/v2 面板统一复用，v2 通过 `LazyTab` + `useAPI()` 兼容两种运行时 |
| **动态数据** | 所有表列表、字段列表、用户/角色列表均从 API 动态加载，无任何硬编码 |
| **服务端资源** | 5 个自定义资源（Import / Export / Tasks / Permissions / TaskLogs），通过 `resourceManager.define()` 注册 |
| **ACL** | 所有自定义 API 需 `loggedIn` 权限；导入/导出额外校验 `sjgl02_table_permissions` 表级权限 |
| **流式导出** | `ExcelJS.stream.xlsx.WorkbookWriter` + 分页查询，无行数上限，内存 ~200MB |
| **批量导入** | 1000 行/批 + 批量查询 + `createMany` 批量写入 + 同批次唯一值去重 |
| **事务回滚** | 导入在单一 Sequelize 事务中执行，任何行失败则全部回滚 |
| **混合执行** | 导入/导出异步执行 — 任务创建后立即返回 taskId，数据处理在后台 `setImmediate` 中执行，不阻塞 HTTP 请求 |
| **互斥锁** | `async-mutex` 防止并发导出互相干扰 |
| **ZIP 打包** | `archiver` 打包 Excel + 附件文件，按字段名分文件夹 |
| **i18n** | zh-CN / en-US，共 115 个翻译键，`tExpr()` 支持延迟翻译 |
| **认证** | v1 通过 `this.app.apiClient.request()` 自动注入 auth token；v2 通过 `useAPI()` 统一客户端 |
| **文件上传** | 通过标准 `attachments:create` API 上传，然后 `uploadParse` 解析内容 |
| **Migrations** | 2 个 migration 文件，`beforeLoad` 自动执行，`yarn nocobase upgrade` 触发 |

---

## 12. 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| 1.0.138 | 2026-07-06 | 修复重构后 v1 区块与 v2 面板的模块引用路径；服务端导出支持空表生成仅含表头的文件；E2E 全部 21 条用例通过 |
| 1.0.136 | 2026-07-06 | E2E member 测试改为 UI 驱动；修复 Page schema 与 ACL，普通用户页面正常渲染；为面板增加 data-testid；新增空表导出边界测试 |
| 1.0.135 | 2026-07-05 | E2E 测试体系改用 API 驱动：管理员导入/导出/任务/权限/审计日志、普通用户权限隔离全部通过 |
| 1.0.133 | 2026-07-05 | 建立完整测试体系：服务端 27 个用例、客户端 30 个用例、E2E 冒烟测试；修复导入流式解析偶发 `.sheets` 错误；修复权限保存 targetType/targetId 读取与空权限合并逻辑 |
| 1.0.131 | 2026-07-04 | 导出数据范围（exportFilter）：权限管理配置数据范围、导出面板按方案只读/自定义筛选、任务详情展示权限方案与范围 |
| 1.0.128 | 2026-07-04 | 修复 insert/upsert-insert 创建人/更新人被 NocoBase context 钩子覆盖的问题；修复 v1 页面「添加区块 → 其他」中「数据管理」入口消失的问题 |
| 1.0.127 | 2026-07-04 | 导入自动填充创建人/更新人/创建时间/更新时间 |
| 1.0.126 | 2026-07-04 | 导入主键全面适配 Snowflake/UUID/Nano ID，阶段三改为 5000 行/批 ORM 创建 |
| 1.0.95 | 2026-07-02 | 导入/导出执行异步化（任务提交后立即返回，后台异步处理） |
| 1.0.94 | 2026-07-02 | 导入权限方案下拉优化 + `__all__` 导出预览404修复 |
| 1.0.92 | 2026-07-02 | 任务表新增 blankCellMode/headerStyle 字段 |
| 1.0.89 | 2026-07-02 | 导出流式写入重构（去 20000 行限制）；导入批次批量操作 |
| 1.0.88 | 2026-07-02 | admin/root 导入模拟权限方案切换 |
| 1.0.87 | 2026-07-02 | 空白单元格处理 + 唯一值空值整批回滚 |
| 1.0.85 | 2026-07-02 | 导出表头格式三选一 |
| 1.0.64 | 2026-07-01 | 任务管理全面重写（列表+详情Drawer+7张卡片+终端日志） |
| 1.0.49 | 2026-06-30 | 权限面板按原型图重写（v1+v2双向同步） |
| 1.0.48 | 2026-06-30 | 权限架构全面升级（hooks/types/panels 目录拆分 + 审计日志表） |
| 1.0.47 | 2026-06-30 | install() 数据重复创建修复 + UNIQUE 约束 |
| 1.0.46 | 2026-06-30 | 服务端权限强制校验首次引入 |
| 1.0.20 | 2026-06-27 | 表级权限管理 + 安装预设管理员权限 |
