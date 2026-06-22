# @my-project/plugin-sjgl02 — 数据管理插件

NocoBase 全栈插件，提供 **Excel 导入、导出、任务管理、表级权限控制** 四大功能。

| 属性 | 值 |
|------|-----|
| 版本 | 1.0.0 |
| 兼容 | NocoBase 2.x |
| 入口 | 设置 → 数据管理 |
| 依赖 | xlsx, exceljs, async-mutex |

---

## 目录

1. [功能概述](#功能概述)
2. [目录结构](#目录结构)
3. [导入功能](#导入功能)
4. [导出功能](#导出功能)
5. [任务管理](#任务管理)
6. [权限管理](#权限管理)
7. [API 端点](#api-端点)
8. [数据模型](#数据模型)
9. [访问入口](#访问入口)
10. [安装与使用](#安装与使用)

---

## 功能概述

| # | 功能 | Tab | 说明 |
|---|------|-----|------|
| 1 | Excel 导入 | 导入 | 3 步向导：选表 → 上传文件 + 字段映射 → 预览 + 执行 |
| 2 | Excel 导出 | 导出 | 3 步向导：选表 → 选字段/配置 → 执行 + 下载；支持 .xlsx / .zip |
| 3 | 任务管理 | 任务管理 | 所有导入/导出任务列表、筛选、日志查看、下载文件、取消 |
| 4 | 表级权限 | 权限管理 | 按用户/角色为每张表配置导入/导出权限、字段范围、导入模式 |

### 两个入口

| 入口 | 路由 | 包含 Tab |
|------|------|----------|
| 设置菜单（v1 管理后台） | `/admin/settings/sjgl02` | 导入 / 导出 / 任务管理 / 权限管理 |
| 设置菜单（v2 管理后台） | `/v2/admin/settings/sjgl02` | 导入 / 导出 / 任务管理 / 权限管理 |
| 页面区块 | v2 页面「添加区块 → 其他 → 数据管理」 | 导入 / 导出 / 任务管理 |

---

## 目录结构

```
plugin-sjgl02/
├── package.json                          # 插件元数据
├── server.js / client.js / client-v2.js  # 运行时 shim
├── README.md                             # 本文件
├── sjgl02-ui.html                        # 交互原型（设计稿）
├── sjgl02-产品文档.html                   # 产品需求规格说明书
├── src/
│   ├── index.ts                          # 主入口
│   ├── server/
│   │   ├── index.ts                      # 服务端入口
│   │   ├── plugin.ts                     # 插件主类（注册资源 + ACL）
│   │   ├── collections/
│   │   │   ├── sjgl02_tasks.ts           # 任务表
│   │   │   ├── sjgl02_table_permissions.ts # 权限表
│   │   │   └── sjgl02_settings.ts        # 设置表
│   │   └── actions/
│   │       ├── import.ts                 # 导入端点
│   │       ├── export.ts                 # 导出端点
│   │       ├── tasks.ts                  # 任务管理端点
│   │       └── permissions.ts            # 权限管理端点
│   ├── client/
│   │   ├── index.ts                      # v1 客户端入口
│   │   └── plugin.tsx                    # v1 客户端：设置页 + 区块组件 + 区块初始化器注册
│   ├── client-v2/
│   │   ├── index.tsx                     # 客户端入口
│   │   ├── plugin.tsx                    # v2 设置菜单注册（addMenuItem + addPageTabItem）
│   │   ├── locale.ts                     # i18n 命名空间
│   │   └── pages/
│   │       ├── Sjgl02SettingsPage.tsx     # 主页面（LazyTab 按需懒加载 4 个 Tab）
│   │       ├── ImportTab.tsx             # 导入向导（动态表列表 + 文件校验 + 字段映射）
│   │       ├── ExportTab.tsx             # 导出向导（动态表字段 + 文件名模板 + 进度轮询）
│   │       ├── TaskTab.tsx               # 任务管理
│   │       └── PermissionTab.tsx         # 权限管理
│   └── locale/
│       ├── zh-CN.json                    # 中文（92 键）
│       └── en-US.json                    # 英文（92 键）
└── dist/                                 # 编译产物
```

---

## 导入功能

### 数据表说明
- 所有数据表从 `sjgl02Permissions:tables` API **动态加载**（数据库实际表），非写死
- 选表后自动调用 `tableFields` API 加载该表真实字段

### 3 步向导

**Step 1 — 选择数据表**
- 下拉选择器，显示有导入权限的数据表
- 支持搜索过滤
- 右侧导入说明面板

**Step 2 — 上传文件 & 字段映射**
- 拖拽上传 .xlsx / .xls / .csv（最大 50MB）
- 上传成功后显示：
  - Sheet 选择器（仅 1 个 Sheet 时禁用）
  - 表头行号（1-100，默认 1）
  - 导入模式：新增(insert) / 更新(update) / 新增+更新(upsert)
  - 唯一值字段选择器（update/upsert 模式下显示）
- 字段映射表：
  - Excel 列 → 映射方式 → 工作表字段
  - 映射方式自动推导：选 Excel 列 → "Excel列"；选自定义 → "固定值"；未选择 → "忽略"
  - 去重联动：已选的 Excel 列在其他行自动禁用
  - "自动匹配"按钮按名称自动对应

**Step 3 — 预览 & 执行**
- 4 个统计卡片：预计行数 / 错误行数 / 导入模式 / Sheet 名称
- update/upsert 模式显示唯一值匹配提示
- 预览数据表（前 10 行）
- 确认弹窗后提交任务

### 导入规则
- 任何数据行失败 → 整批回滚，不写入任何数据
- 必填字段未映射 → 后端校验返回错误
- 关联字段匹配不到 → 记录行级错误日志
- 同一 Excel 列不可重复选择

---

## 导出功能

### 3 步向导

**Step 1 — 选择数据表**
- 下拉首选项「全部数据表（含系统表）」蓝色分隔
- 选全部数据表 → Step 2 切换为全部导出模式

**Step 2 — 配置（单表 / 全表）**

**单表模式：**
| 配置项 | 说明 |
|--------|------|
| 字段选择 | 复选框分组：常规 / 关联(紫色) / 附件(青色)，支持全选 + 已选计数 |
| 关联字段显示 | 每个关联字段可选「显示值」/「仅ID」 |
| 关联数据 Sheet | Switch 开关，开启可包含关联表数据 |
| 数据范围 | 「全部数据」/「自定义条件」 |
| 高级选项 | 文件名模板（默认 `{表名}_{日期}.xlsx`，支持 `{表名}` `{日期}` 占位符） + 包含附件文件开关 |

**全部数据表模式：**
- 蓝色警告：将导出全部表（含系统表）
- 导出标签列表，含附件标注
- 最终打包为 ZIP

**Step 3 — 执行导出**
- 统计卡片 + 已选字段标签列表
- 提交后 2 秒轮询进度
- 完成后显示下载按钮

### 文件格式
| 场景 | 格式 |
|------|------|
| 单表 + 无附件 | .xlsx |
| 单表 + 含附件 | .zip |
| 全部数据表 | .zip |

---

## 任务管理

### 筛选栏

| 筛选 | 选项 |
|------|------|
| 任务类型 | 全部 / 导入 / 导出 |
| 状态 | 全部 / 排队中 / 进行中 / 已完成 / 失败 / 已取消 |

### 表格列

| 列 | 说明 |
|----|------|
| 任务ID | #1001 格式 |
| 类型 | 导入(蓝) / 导出(绿) |
| 目标表 | 表名 |
| 状态 | 排队中(橙) / 进行中(蓝) / 已完成(绿) / 失败(红) / 已取消(灰) |
| 进度 | 进度条 + 百分比 |
| 数据量 | 已处理/总数 |
| 创建人 | 用户名 |
| 创建时间 | 日期时间 |
| 完成时间 | 日期时间，未完成显示 — |
| 操作 | 查看(打开日志抽屉) / 取消(仅 pending/processing) |

### 日志抽屉（右侧 680px）
- 任务摘要：ID、类型、目标表、创建人、时间、文件名、状态、数据量
- 下载区域：已完成任务显示绿色提示 + 下载按钮
- 字段详情：导入→字段映射表 / 导出→字段选择标签
- 错误日志：行号 / 错误原因 / 字段值快照，无错误显示空状态

---

## 权限管理

### 布局
- 左侧栏（span=6）：用户 / 角色列表
- 右侧卡片（span=18）：权限卡片列表

### 左侧列表
- 用户（蓝色头像 + 名字）在上，角色（绿色头像 + 名字）在下
- 点击切换高亮（蓝色背景）

### 右侧权限卡片
- 每条权限一张卡片：表名 + 导入/导出开关 + 编辑/删除按钮
- 标签行：导入是否 / 导出是否 / 导入模式 / 唯一值字段 / 必填字段 / 可导入数 / 可导出数
- 开关点击实时保存到内存

### 权限编辑弹窗（Modal 720px）

| 字段 | 说明 |
|------|------|
| 选择数据表 | 必填，搜索过滤 |
| 允许导入/导出 | Switch 开关，分别控制下方区域显隐 |
| 导入模式 | 新增 / 更新 / 新增+更新 |
| 唯一值字段 | 多选 |
| 必填字段 | 多选 |
| 可导入字段 | 多选，空 = 全部允许 |
| 可导出字段 | 多选，空 = 全部允许 |
| 导出筛选 | 条件构建器 |

---

## API 端点

### 导入（4 个）

| 端点 | 方法 | 参数 |
|------|------|------|
| `sjgl02Import:tableFields` | GET | `tableName` |
| `sjgl02Import:upload` | POST | multipart `file` → `{ sheets, headerColumns, fileId }` |
| `sjgl02Import:preview` | POST | `{ fileId, sheetName, headerRow, fieldMapping }` → 预览 N 行 |
| `sjgl02Import:execute` | POST | `{ tableName, fileId, sheetName, headerRow, fieldMapping, importMode }` → `{ taskId }` |

### 导出（5 个）

| 端点 | 方法 | 参数 |
|------|------|------|
| `sjgl02Export:tableFields` | GET | `tableName` |
| `sjgl02Export:previewCount` | POST | `{ tableName, filter }` → 预估行数 |
| `sjgl02Export:execute` | POST | `{ tableName, selectedFields, ... }` → `{ taskId }` |
| `sjgl02Export:progress` | GET | `taskId` → 进度 + exportFileId |
| `sjgl02Export:download` | GET | `taskId` → 文件流 |

### 任务管理（4 个）

| 端点 | 方法 | 参数 |
|------|------|------|
| `sjgl02Tasks:list` | GET | 分页 + 筛选 |
| `sjgl02Tasks:detail` | GET | `taskId` |
| `sjgl02Tasks:logs` | GET | `taskId` → errorLogs + fieldMapping |
| `sjgl02Tasks:cancel` | POST | `{ taskId }` |

### 权限管理（6 个）

| 端点 | 方法 | 参数 |
|------|------|------|
| `sjgl02Permissions:userRoleList` | GET | — |
| `sjgl02Permissions:tables` | GET | — |
| `sjgl02Permissions:get` | GET | `targetType, targetId` |
| `sjgl02Permissions:save` | POST | 全量权限对象（upsert） |
| `sjgl02Permissions:settings` | GET | — |
| `sjgl02Permissions:saveSettings` | POST | 全局设置 |

---

## 数据模型

### sjgl02_tasks（导入导出任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增 |
| taskType | string | import / export |
| tableName | string | 目标表名 |
| status | string | pending / processing / completed / failed / cancelled |
| fieldMapping | json | 字段映射配置 |
| selectedFields | json | 导出选中字段 |
| exportFilter | json | 导出筛选条件 |
| errorLogs | json | 错误日志数组 |
| progress | integer | 0-100 |
| totalRows | integer | 总行数 |
| processedRows | integer | 已处理行数 |
| importMode | string | insert / update / upsert |
| sheetName | string | Sheet 名称 |
| headerRow | integer | 表头行号，默认 1 |
| importFileId | integer | 导入源文件附件 ID |
| exportFileId | integer | 导出文件附件 ID |
| errorMessage | text | 失败错误信息 |
| includeAssociationSheet | boolean | 是否包含关联 Sheet |
| associationSheetTables | json | 关联表列表 |
| associationDisplayMode | json | 关联字段显示模式 |
| completedAt | datetime | 完成时间 |
| createdBy | belongsTo users | 创建人 |

### sjgl02_table_permissions（表级权限）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer PK | 自增 |
| targetType | string | user / role |
| targetId | integer | 目标 ID |
| targetName | string | 冗余名称 |
| tableName | string | 数据表名 |
| canImport | boolean | 默认 false |
| canExport | boolean | 默认 false |
| importMode | string | insert / update / upsert |
| uniqueFields | json | 唯一值字段列表 |
| requiredFields | json | 必填字段列表 |
| importFields | json | 可导入字段（空=全部） |
| exportFields | json | 可导出字段（空=全部） |
| exportFilter | json | 导出筛选 |

### sjgl02_settings（全局设置）

| 字段 | 类型 | 默认值 |
|------|------|--------|
| taskViewScope | string | own |
| maxFileSize | integer | 50 (MB) |
| batchSize | integer | 1000 |

---

## 访问入口

插件启用后有两种访问方式：

### 1. 设置菜单入口（完整功能，含权限管理）

```
登录 → 设置 → 数据管理
v1 路径: /admin/settings/sjgl02
v2 路径: /v2/admin/settings/sjgl02
```

包含 4 个 Tab：导入 / 导出 / 任务管理 / 权限管理

### 2. 页面区块入口（不含权限管理）

```
v2 页面 → 添加区块 → 其他区块 → 数据管理
```

包含 3 个 Tab：导入 / 导出 / 任务管理

---

## 安装与使用

### 安装依赖

```bash
cd nocobase-2.1.9
# 依赖已在 workspace 中自动链接
yarn install
```

### 启用插件

```bash
yarn nocobase pm enable @my-project/plugin-sjgl02
```

### 构建插件

```bash
yarn build
# 只构建本插件（通过 lerna scope）
```

### 开发模式

```bash
yarn dev
# 插件修改后自动热更新
```

### 访问

```
http://localhost:13000 → 登录 → 设置 → 数据管理
```

---

## 技术要点

- **客户端**：仅使用 client-v2（v1 为最小 stub），基于 Ant Design v5 + react-i18next
- **服务端**：4 个自定义资源（`sjgl02Import` / `sjgl02Export` / `sjgl02Tasks` / `sjgl02Permissions`），通过 `resourceManager.define()` 注册
- **权限**：所有自定义 API 需要 `loggedIn` 权限
- **国际化**：中文 `zh-CN` / 英文 `en-US`，共 92 个翻译键
- **事务规则**：导入在单一事务中执行，任何数据行失败则整批回滚
- **懒加载**：4 个 Tab 采用 LazyTab 按需加载，切换时重新挂载，首次显示加载中占位
- **文件校验**：上传前校验扩展名（.xlsx/.xls/.csv）和大小（≤50MB），不合法直接拒绝
- **防重入**：导出执行中禁止重复点击，完成后才可再次操作

---

## 更新日志

### v1.0.0（2026-06-22 最终版）
- 动态数据表：从 API 加载数据库实际表（106 张），替代硬编码
- 懒加载 Tab：切换时按需渲染，解决切换不刷新问题
- 文件校验：beforeUpload 校验格式和大小
- 文件名模板：全表导出 Input 可编辑，支持 `{表名}` `{日期}` 占位符
- 字段选择：从数据库字段 API 动态加载分组
- 双入口：v1 客户端（设置菜单 + 区块注册）+ v2 客户端（设置菜单）
- 防重入：导出执行按钮 loading 状态 + disabled 控制
- 服务端兼容：tables / fields API 适配 NocoBase collections Map 结构
