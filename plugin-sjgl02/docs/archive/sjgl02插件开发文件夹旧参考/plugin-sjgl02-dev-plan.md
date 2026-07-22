# @my-project/plugin-sjgl02 开发计划文档

> 版本: v2.0.0 | 日期: 2026-07-11 | 作者: AI Coding Agent
>
> 本文档基于交互原型 `sjgl02-prototype.html` 全面对齐，所有技术决策已确认，可据此直接开发。

---

## 一、项目概述

### 1.1 插件定位

`@my-project/plugin-sjgl02`（数据管理02）是一个 NocoBase 通用数据管理插件，为任意数据表提供**百万级导入/导出**、**任务监控**、**权限控制**能力。

### 1.2 核心功能

| 功能模块 | 说明 |
|----------|------|
| 百万级导入 | 支持 xlsx（无限制）/ xls（限制20万条）/ csv 三种格式，流式解析，后台异步处理 |
| 百万级导出 | 仅 xlsx 格式，游标分页读取，流式写入，超百万行自动分表 |
| 权限切换 | 导入时可选择用户权限或角色权限配置（两套独立），导入模式和字段自动锁定 |
| 事务策略 | 严格模式（失败全部回滚），固定不可选 |
| 数据校验 | 多字段组合唯一值校验，空值唯一值预检，自定义内容填写 |
| 系统字段处理 | 自动处理 createdAt/updatedAt/createdById/updatedById/id 等 NocoBase 系统字段 |
| 附件处理 | 导入支持 tar.gz 压缩包解压附件（固定目录 `attachments/`），导出支持附件打包 tar.gz 下载 |
| 空白值处理 | 按 Excel 更新（清空）/ 不更新（保留原值）两种策略 |
| 多对多关联 | 导入全量替换，更新模式为空时有配置选项（清空/保留） |
| 数据范围筛选 | 导出支持 AND 多行筛选条件（全部数据 / 自定义条件） |
| 关联表导出 | 关联表可作为独立 Sheet 或独立 xlsx 文件导出，关联表也超百万行分表 |
| 字段名配置 | 导出列头可选：字段名称(字段名) / 字段名称 / 字段名 |
| 任务管理 | 9列表格，任务状态跟踪、进度监控、取消（全部回滚）、详情抽屉（JSON快照）、错误详情（导出xlsx） |
| 权限管理 | 按用户/角色控制导入/导出/任务管理权限，支持自定义权限（与继承权限两套独立），操作日志 |
| 全部数据表导出 | admin/root 可导出全部数据表（含系统表、含中间表），打包为 tar.gz |

### 1.3 技术约束

- 目标数据范围：NocoBase 中任意数据表（通用数据表）
- 入口方式：v2 页面添加区块 + 设置中心入口
- 客户端运行时：**仅 v2**（`@nocobase/client-v2`），不实现 v1 客户端
- 遵循 `AGENTS.md` 规范：v2 不导入 v1

---

## 二、技术方案

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                           Client-v2                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ImportBlock │ │ExportBlock │ │TaskListBlk │ │PermManageBlk │  │
│  │(FlowModel) │ │(FlowModel) │ │(FlowModel) │ │(FlowModel)   │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘  │
│        │              │              │               │           │
│  ┌─────┴──────────────┴──────────────┴───────────────┴────────┐  │
│  │              Settings Page (设置中心入口)                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐                  │  │
│  │  │任务历史  │ │权限配置  │ │导入导出配置│                  │  │
│  │  └──────────┘ └──────────┘ └────────────┘                  │  │
│  └────────────────────────┬────────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP API + WebSocket
┌───────────────────────────┼──────────────────────────────────────┐
│                          Server                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐ │
│  │import  │ │export  │ │tasks   │ │perm-mgr  │ │ ACL snippets │ │
│  │action  │ │action  │ │action  │ │action    │ │              │ │
│  └───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘ └──────────────┘ │
│      │          │          │           │                          │
│  ┌───┴──────────┴──────────┴───────────┴───────────────────────┐ │
│  │              sjgl02Tasks 集合（任务记录，含 result JSON 快照） │ │
│  │              sjgl02Permissions 集合（权限配置，roleName/userId） │ │
│  │              sjgl02PermissionLogs 集合（权限操作日志）          │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │                                        │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │  ImportTaskType                │  ExportTaskType             │ │
│  │  ├─ FormatRouter (xlsx/xls/csv)│  ├─ SmartCursorBuilder      │ │
│  │  ├─ PermissionSwitcher         │  ├─ MultiSheetWriter        │ │
│  │  ├─ SystemFieldHandler         │  ├─ RelationExporter        │ │
│  │  ├─ UniqueValidator+EmptyPreCheck │  ├─ AttachmentExporter   │ │
│  │  ├─ ManyToManyHandler          │  ├─ DataFilterBuilder       │ │
│  │  ├─ CustomFiller               │  └─ HeaderConfigurator       │ │
│  │  ├─ BlankValueHandler          │                              │ │
│  │  ├─ AttachmentImporter (tar.gz)│                              │ │
│  │  └─ TransactionManager         │                              │ │
│  │     (取消=全部回滚)             │                             │ │
│  └────────────────────────────────┴─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 关键技术选型

| 技术点 | 方案 | 原因 |
|--------|------|------|
| xlsx 解析 | ExcelJS 流式读取 | 逐行 yield，内存恒定，支持百万行 |
| xls 解析 | SheetJS (`xlsx` 库) `XLSX.read` | ExcelJS 不支持 .xls 格式；SheetJS 全量读入内存，因此限制 20 万条 |
| csv 解析 | ExcelJS CSV 流式读取 (`workbook.csv.read`) | 逐行读取，内存恒定；ExcelJS 内部已打包 fast-csv |
| tar.gz 解压 | `tar-stream` + `gunzip-maybe` 流式解压 | tar.gz 格式支持；流式处理，内存可控；路径穿越防护 |
| tar.gz 打包 | `tar-stream` + `zlib.createGzip()` | 流式打包，支持大文件 |
| 数据库分页 | SmartCursorBuilder 游标 | 避免 OFFSET 深度分页性能退化 |
| 后台任务 | 复用 TaskType 基础设施 | 已有状态管理、进度推送、集群分发、取消机制 |
| 文件写入 | ExcelJS stream.xlsx.WorkbookWriter | 流式写入临时文件，不占内存 |
| 进度推送 | WebSocket（ws:sendToUser） | 实时进度，500ms 节流 |
| 客户端框架 | FlowModel（v2） | 符合 NocoBase v2 架构，响应式状态管理 |
| 错误报告 | ExcelJS 生成 xlsx | 与导出格式一致，用户熟悉 |

### 2.3 现有能力复用

| 来源 | 复用内容 | 用途 |
|------|----------|------|
| `plugin-async-task-manager` | `TaskType` 基类、`EventQueue`、进度推送 | 导入/导出任务生命周期管理 |
| `plugin-action-export` | `SmartCursorBuilder`、ExcelJS 流式写入模式 | 导出服务参考实现 |
| `plugin-action-import` | `koa-multer` 上传、分块事务模式 | 导入服务参考实现 |
| `plugin-file-manager` | `uploadFile()`、`createFileRecord()`、`getFileStream()` | 附件导入上传、附件导出读取 |
| `plugin-backups` | 路径安全防护 `resolvePathWithinBase()` | 附件压缩包解压路径穿越防护 |
| `plugin-acl` | `roles`、`rolesUsers`、`rolesResourcesActions` 集合 | 角色/权限管理 |
| `@nocobase/client-v2` | `BlockModel`、`PluginSettingsManager` | v2 区块和设置页 |

---

## 三、文件结构

```
	packages/plugins/@my-project/plugin-sjgl02/
├── package.json
├── server.js / server.d.ts
├── client-v2.js / client-v2.d.ts
├── .npmignore
├── README.md
├── static/
│   └── attachment-template.tar.gz         # 预制附件导入模板
├── src/
│   ├── index.ts
│   ├── locale/
│   │   ├── en-US.json
│   │   └── zh-CN.json
│   ├── server/
│   │   ├── index.ts
│   │   ├── plugin.ts
│   │   ├── collections/
│   │   │   ├── sjgl02Tasks.ts
│   │   │   ├── sjgl02Permissions.ts
│   │   │   └── sjgl02PermissionLogs.ts
│   │   ├── actions/
│   │   │   ├── import.ts
│   │   │   ├── export.ts
│   │   │   ├── tasks.ts
│   │   │   ├── permissions.ts
│   │   │   └── permission-logs.ts
│   │   └── services/
│   │       ├── streaming-importer.ts
│   │       ├── streaming-exporter.ts
│   │       ├── format-detector.ts
│   │       ├── permission-switcher.ts
│   │       ├── system-field-handler.ts
│   │       ├── many-to-many-handler.ts     # 多对多全量替换 + 空值配置
│   │       ├── unique-validator.ts
│   │       ├── attachment-importer.ts
│   │       ├── attachment-exporter.ts
│   │       ├── data-filter-builder.ts
│   │       ├── multi-sheet-writer.ts
│   └── client-v2/
│       ├── index.tsx
│       ├── plugin.tsx
│       ├── locale.ts
│       ├── models/
│       │   ├── ImportBlockModel.tsx
│       │   ├── ExportBlockModel.tsx
│       │   ├── TaskListBlockModel.tsx
│       │   └── PermissionBlockModel.tsx
│       └── pages/
│           ├── TaskHistoryPage.tsx
│           ├── PermissionManagePage.tsx
│           └── ImportExportConfigPage.tsx
```

---

## 四、详细设计

### 4.1 数据库集合

#### 4.1.1 任务记录表：`sjgl02Tasks`

```typescript
// src/server/collections/sjgl02Tasks.ts
{
  name: 'sjgl02Tasks',
  title: '数据管理任务',
  fields: [
    { name: 'id',              type: 'uuid',       primaryKey: true },
    { name: 'type',            type: 'enum',       values: ['import', 'export'] },
    { name: 'status',          type: 'enum',       values: ['pending', 'running', 'succeeded', 'failed', 'canceled'] },
    { name: 'title',           type: 'string' },
    {
      name: 'params',          type: 'json',
      // 导入结构示例:
      // {
      //   dataSource: 'main', collection: 'users', format: 'xlsx',
      //   filePath: '/storage/tmp/xxx.xlsx', fileName: '用户导入数据_20260709.xlsx',
      //   fileSize: 131072, sheetName: 'Sheet1', headerRow: 1,
      //   permissionConfigId: 'uuid', permissionType: 'user' | 'role',
      //   columnMapping: [{ excelColumn, field, mode: 'excel'|'custom'|'ignore', customValue }, ...],
      //   transactionMode: 'strict',  // 固定严格模式，失败全部回滚
      //   uniqueRules: [{ fields: ['phone','email'] }],
      //   customFills: [{ field: 'status', value: 'active' }],
      //   blankValueStrategy: 'skip' | 'clear',
      //   attachmentTarPath: '/storage/tmp/attachments.tar.gz',
      //   updateMode: 'insert' | 'update' | 'upsert',
      //   manyToManyEmptyStrategy: 'clear' | 'preserve',  // 多对多字段为空时的处理
      // }
      // 导出结构示例:
      // {
      //   dataSource: 'main', collection: 'users',
      //   columns: [{ dataIndex, title, headerType, dateFormat }, ...],
      //   filter: { status: 'active' },
      //   headerType: 'displayName_fieldName' | 'displayName' | 'fieldName',
      //   relationExportMode: 'separateSheet' | 'separateFile',
      //   relationFields: ['role', 'dept', 'createdBy', 'tags'],
      //   exportAttachments: true | false,
      //   includeSystemTables: true | false,
      //   autoSplitSheet: true,
      //   dateFieldFormats: { createdAt: 'YYYY-MM-DD HH:mm:ss' },
      // }
    },
    {
      name: 'result',          type: 'json',
      // 任务完成时的完整快照，包含：
      // {
      //   filePath: '/storage/tmp/export_xxx.xlsx',
      //   downloadUrl: '/api/sjgl02Tasks:download?id=xxx',
      //   totalRows: 1000000, successRows: 999950, errorRows: 50,
      //   sheetCount: 2, duration: 135000,
      //   errors: [{ row: 123, field: 'email', message: '格式错误', data: {...} }],
      //   // 导入专属
      //   columnMapping: [...], importStats: { total, success, failed, reason },
      //   previewRows: [...],  // 前10行
      //   // 导出专属
      //   exportColumns: [...], exportConfig: {...},
      //   relationDetails: [{ field, type, target, displayField, exportValue, exportMode, sheetName, rowCount }],
      //   tableList: [...],  // 全部数据表导出时的表清单
      // }
    },
    { name: 'progressTotal',   type: 'integer' },
    { name: 'progressCurrent', type: 'integer' },
    { name: 'startedAt',       type: 'datetime' },
    { name: 'doneAt',          type: 'datetime' },
    { name: 'duration',        type: 'integer' },     // 耗时（毫秒）
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: false,
  logging: true,
}
```

#### 4.1.2 权限配置表：`sjgl02Permissions`

```typescript
// src/server/collections/sjgl02Permissions.ts
{
  name: 'sjgl02Permissions',
  title: '数据管理权限配置',
  fields: [
    { name: 'id',              type: 'uuid',       primaryKey: true },
    { name: 'targetType',      type: 'enum',       values: ['user', 'role'] },
    // 角色权限: targetId = roleName（字符串，如 "admin"、"editor"）
    // 用户权限: targetId = userId（uuid，用户主键）
    { name: 'targetId',        type: 'string' },
    { name: 'targetName',      type: 'string' },     // 用户名称 或 角色名称（冗余，便于展示）
    { name: 'collectionName',  type: 'string' },     // 数据表名
    { name: 'collectionTitle', type: 'string' },     // 数据表标题
    { name: 'canImport',       type: 'boolean' },    // 允许导入
    { name: 'canExport',       type: 'boolean' },    // 允许导出
    { name: 'importModes',     type: 'json' },       // ['insert','update','upsert']
    { name: 'uniqueFields',    type: 'json' },       // ['phone','email']
    { name: 'requiredFields',  type: 'json' },       // ['name','phone']
    { name: 'importFields',    type: 'json' },       // 可导入字段白名单，空=全部
    { name: 'exportFields',    type: 'json' },       // 可导出字段白名单，空=全部
    { name: 'exportFilter',    type: 'json' },       // [{ field, operator, value }]
    { name: 'sort',            type: 'integer' },
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: true,
  logging: true,
}
```

#### 4.1.3 操作日志表：`sjgl02PermissionLogs`

```typescript
// src/server/collections/sjgl02PermissionLogs.ts
{
  name: 'sjgl02PermissionLogs',
  title: '权限操作日志',
  fields: [
    { name: 'id',              type: 'uuid',       primaryKey: true },
    { name: 'action',          type: 'enum',       values: ['create', 'update', 'delete', 'toggle'] },
    { name: 'targetType',      type: 'enum',       values: ['user', 'role'] },
    { name: 'targetId',        type: 'string' },     // roleName 或 userId
    { name: 'targetName',      type: 'string' },
    { name: 'collectionName',  type: 'string' },
    { name: 'collectionTitle', type: 'string' },
    { name: 'summary',         type: 'text' },
    { name: 'beforeValue',     type: 'json' },
    { name: 'afterValue',      type: 'json' },
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: false,
  logging: false,
}
```

---

### 4.2 导入功能详细设计

#### 4.2.1 三种格式路由

保持不变。

#### 4.2.2 权限切换服务（两套独立）

```typescript
// src/server/services/permission-switcher.ts
interface PermissionConfig {
  id: string;
  targetType: 'user' | 'role';
  targetName: string;
  canImport: boolean;
  importModes: ('insert' | 'update' | 'upsert')[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
}

class PermissionSwitcher {
  /**
   * 获取用户可用的权限配置列表
   * - 角色继承权限和用户自定义权限是两套独立的存在
   * - admin/root: 可查看全部用户和角色的权限配置
   * - 普通用户: 仅查看自己的用户权限 + 所属角色的权限
   */
  async getAvailablePermissions(ctx: Context, collectionName: string): Promise<{
    userPermissions: PermissionConfig[];
    rolePermissions: PermissionConfig[];
  }> {
    const currentUser = ctx.state.currentUser;
    const currentRoles = ctx.state.currentRoles || [];
    const isPrivileged = currentRoles.includes('root') || currentRoles.includes('admin');

    const query = { collectionName };

    if (isPrivileged) {
      const all = await this.db.getRepository('sjgl02Permissions').find({ filter: query });
      return {
        userPermissions: all.filter(p => p.targetType === 'user'),
        rolePermissions: all.filter(p => p.targetType === 'role'),
      };
    } else {
      // 角色权限：targetId 存 roleName
      const userPerms = await this.db.getRepository('sjgl02Permissions').find({
        filter: { ...query, targetType: 'user', targetId: currentUser.id },
      });
      const rolePerms = await this.db.getRepository('sjgl02Permissions').find({
        filter: { ...query, targetType: 'role', targetId: { $in: currentRoles } },
      });
      return { userPermissions: userPerms, rolePermissions: rolePerms };
    }
  }

  /**
   * 根据选中的权限配置，锁定导入模式和可导入字段
   * 更新/upsert 模式必须至少选1个唯一值字段
   */
  applyPermissionConfig(config: PermissionConfig, allFields: FieldModel[]): {
    allowedModes: string[];
    allowedFields: string[];
    uniqueFields: string[];
    requiredFields: string[];
  } {
    return {
      allowedModes: config.importModes,
      allowedFields: config.importFields.length > 0
        ? config.importFields
        : allFields.map(f => f.name),
      uniqueFields: config.uniqueFields,
      requiredFields: config.requiredFields,
    };
  }
}
```

#### 4.2.3 导入模式约束

```typescript
// 导入 action 中校验
async function importAction(ctx: Context, next: Next) {
  const { permissionConfigId, updateMode, uniqueFields } = ctx.request.body;

  // 更新/upsert 模式必须至少选1个唯一值字段
  if ((updateMode === 'update' || updateMode === 'upsert') && (!uniqueFields || uniqueFields.length === 0)) {
    ctx.throw(400, '更新/新增+更新模式必须至少选择1个唯一值字段');
  }

  const permConfig = await ctx.db.getRepository('sjgl02Permissions').findOne({
    filter: { id: permissionConfigId },
  });

  if (!permConfig || !permConfig.canImport) {
    ctx.throw(403, '无导入权限');
  }

  if (!permConfig.importModes.includes(updateMode)) {
    ctx.throw(400, '所选权限配置不支持此导入模式');
  }

  // 创建任务，快照权限配置信息到 params
  // ...
}
```

#### 4.2.4 系统字段处理

保持不变。

#### 4.2.5 多对多关联处理

```typescript
// src/server/services/many-to-many-handler.ts
type ManyToManyEmptyStrategy = 'clear' | 'preserve';

class ManyToManyHandler {
  /**
   * 处理多对多关联字段导入
   * - 导入时：全量替换
   * - 更新模式下 Excel 为空时：根据配置决定清空还是保留
   */
  async handleManyToMany(
    record: any,
    fieldName: string,
    excelValue: string | null,
    strategy: ManyToManyEmptyStrategy,
    targetCollection: string
  ): Promise<void> {
    if (excelValue && excelValue.trim() !== '') {
      // 有值：全量替换
      const ids = excelValue.split(',').map(s => s.trim()).filter(Boolean);
      const relatedRecords = await this.db.getRepository(targetCollection).find({
        filter: { id: { $in: ids } },
      });
      await record.setDataValue(fieldName, relatedRecords);
    } else {
      // 为空
      if (strategy === 'clear') {
        await record.setDataValue(fieldName, []);  // 清空关联
      }
      // preserve: 不处理，保留原关联
    }
  }
}
```

#### 4.2.6 空值唯一值预检

保持不变。

#### 4.2.7 事务策略 + 取消全部回滚

```typescript
class TransactionManager {
  async executeStrict() {
    const transaction = await this.db.sequelize.transaction();
    try {
      // 检查取消信号
      if (this.isCanceled()) {
        await transaction.rollback();
        return { status: 'canceled' };
      }
      await this.writeAllInTransaction(transaction);
      if (this.isCanceled()) {
        await transaction.rollback();
        return { status: 'canceled' };
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 取消时回滚所有已写入的数据
  private async rollbackCommittedBlocks(blocks: any[]) {
    for (const { block } of blocks.reverse()) {
      await this.db.getRepository(this.collection).destroy({
        filter: { id: { $in: block.ids } },
      });
    }
  }
}
```

#### 4.2.8 附件导入（tar.gz，固定目录 `attachments/`）

```typescript
// src/server/services/attachment-importer.ts
import * as tar from 'tar-stream';
import { createGunzip } from 'zlib';

class AttachmentImporter {
  /**
   * 解压 tar.gz 并查找 attachments/ 目录下的文件
   * 固定目录名：attachments/
   */
  async extractTarGz(tarPath: string, extractDir: string): Promise<Map<string, string>> {
    const fileMap = new Map<string, string>(); // filename -> absolutePath

    const extract = tar.extract();
    const gunzip = createGunzip();

    return new Promise((resolve, reject) => {
      extract.on('entry', (header, stream, next) => {
        // 只处理 attachments/ 目录下的文件
        const normalizedName = header.name.replace(/^\.\/|^\/+/, '');
        if (!normalizedName.startsWith('attachments/') || header.type !== 'file') {
          stream.resume();
          next();
          return;
        }

        const fileName = path.basename(normalizedName);
        const safePath = resolvePathWithinBase(extractDir, fileName);
        if (!safePath) {
          stream.resume();
          next();
          return;
        }

        stream.pipe(fs.createWriteStream(safePath));
        stream.on('end', () => {
          fileMap.set(fileName, safePath);
          next();
        });
        stream.resume();
      });

      extract.on('finish', () => resolve(fileMap));
      extract.on('error', reject);
      createReadStream(tarPath).pipe(gunzip).pipe(extract);
    });
  }
}
```

#### 4.2.9 空白值处理

保持不变。

---

### 4.3 导出功能详细设计

#### 4.3.1 字段名配置（三种列头）

保持不变。

#### 4.3.2 关联表导出（Sheet/独立文件，关联表也分表）

```typescript
class RelationExporter {
  /**
   * 关联表也超百万行分表，命名体现关联关系
   * 格式：主表字段名称(主表字段标识)-关联表名称(关联表标识)_序号
   * 例：角色(role)-角色(roles)_1
   */
  async exportSeparateSheet(
    workbook: Excel.stream.xlsx.WorkbookWriter,
    mainFieldName: string,
    mainFieldKey: string,
    relationField: RelationField,
    mainRows: any[]
  ) {
    const baseSheetName = `${mainFieldName}(${mainFieldKey})-${relationField.targetTitle}(${relationField.target})`;
    const writer = new MultiSheetWriter(workbook, baseSheetName, columns);
    // ... 写入关联数据，自动分表
  }
}
```

#### 4.3.3 数据范围筛选

保持不变。

#### 4.3.4 附件导出（tar.gz）

保持不变。

#### 4.3.5 超百万行自动分表

保持不变。

#### 4.3.6 全部数据表导出（含中间表）

```typescript
async function exportAllTables(ctx: Context, next: Next) {
  const isPrivileged = ctx.state.currentRoles?.includes('root')
                    || ctx.state.currentRoles?.includes('admin');

  if (!isPrivileged) {
    ctx.throw(403, '仅 admin/root 可导出全部数据表');
  }

  // 获取所有集合，不过滤 dataCategory，包含系统表和中间表
  const collections = await ctx.db.getCollectionManager().getCollections();
  const exportFiles: string[] = [];
  const tableList: { name: string; title: string; rowCount: number; hasAttachment: boolean }[] = [];

  for (const collection of collections) {
    const filePath = await this.exportCollectionToXlsx(collection);
    exportFiles.push(filePath);
    const rowCount = await ctx.db.getRepository(collection.name).count();
    tableList.push({
      name: collection.name,
      title: collection.options?.title || collection.name,
      rowCount,
      hasAttachment: this.hasAttachmentField(collection),
    });
  }

  // 打包为 tar.gz
  const tarPath = path.join(tmpdir, `全部数据表-${formatDate(new Date())}.tar.gz`);
  await this.packToTarGz(exportFiles, tarPath);

  // 创建任务，快照 tableList 到 result
  const task = await ctx.db.getRepository('sjgl02Tasks').create({
    values: {
      type: 'export',
      status: 'pending',
      params: { includeSystemTables: true },
      result: { filePath: tarPath, tableList, sheetCount: exportFiles.length },
    },
  });
}
```

---

### 4.4 权限管理详细设计

#### 4.4.1 权限配置 CRUD（roleName / userId）

```typescript
// 创建角色权限：targetId = roleName
await ctx.db.getRepository('sjgl02Permissions').create({
  values: {
    targetType: 'role',
    targetId: 'editor',        // roleName
    targetName: '编辑(editor)',
    collectionName: 'users',
    canImport: true,
    importModes: ['insert', 'update', 'upsert'],
    uniqueFields: ['phone', 'email'],
    requiredFields: ['name', 'phone'],
  },
});

// 创建用户权限：targetId = userId
await ctx.db.getRepository('sjgl02Permissions').create({
  values: {
    targetType: 'user',
    targetId: currentUser.id,  // userId（uuid）
    targetName: '张明',
    collectionName: 'customers',
    canImport: true,
    importModes: ['upsert'],
    uniqueFields: ['customerCode'],
    requiredFields: ['name', 'phone'],
    importFields: ['name', 'phone', 'email', 'address', 'remark'],
  },
});
```

#### 4.4.2 权限继承与自定义权限（两套独立）

```
权限配置体系（两套独立）:
├─ 角色继承权限（不可编辑）
│  ├─ 来源：用户所属角色的权限配置
│  ├─ 在权限管理页面显示为灰色卡片，只读
│  ├─ 在导入/导出步骤②中通过"权限切换"下拉可选择
│  └─ 查询方式：targetType='role' AND targetId IN (用户角色名列表)
│
├─ 用户自定义权限（可编辑/删除）
│  ├─ 来源：用户直接创建的权限配置
│  ├─ 在权限管理页面显示为白色卡片，可编辑/删除
│  ├─ 在导入/导出步骤②中通过"权限切换"下拉可选择
│  └─ 查询方式：targetType='user' AND targetId = 当前用户ID
│
└─ 权限切换下拉
   ├─ 分组：👤用户权限 / 🔐角色权限
   ├─ 选中后导入模式自动锁定
   └─ 字段映射只显示该权限配置中"可导入"的字段
```

#### 4.4.3 操作日志

保持不变。

#### 4.4.4 ACL Snippet 体系

保持不变。

---

### 4.5 任务详情 API（JSON 快照）

```typescript
// src/server/actions/tasks.ts
async function tasksDetailAction(ctx: Context, next: Next) {
  const { id } = ctx.params;
  const task = await ctx.db.getRepository('sjgl02Tasks').findOne({ filter: { id } });

  if (!task) {
    ctx.throw(404, '任务不存在');
  }

  // 所有详情数据已在任务完成时快照存入 result JSON 字段
  // 预览数据限制前10行
  ctx.body = {
    id: task.id,
    type: task.type,
    status: task.status,
    title: task.title,
    params: task.params,      // 任务配置
    result: task.result,      // 执行结果快照（含映射、统计、预览、日志）
    progressTotal: task.progressTotal,
    progressCurrent: task.progressCurrent,
    startedAt: task.startedAt,
    doneAt: task.doneAt,
    duration: task.duration,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
  };

  await next();
}
```

#### 任务完成时的快照生成

```typescript
// 在 ImportTaskType / ExportTaskType 完成时生成快照
async function buildResultSnapshot(task: any, executionResult: any): Promise<any> {
  return {
    filePath: executionResult.filePath,
    downloadUrl: `/api/sjgl02Tasks:download?id=${task.id}`,
    totalRows: executionResult.totalRows,
    successRows: executionResult.successRows,
    errorRows: executionResult.errorRows,
    sheetCount: executionResult.sheetCount,
    duration: task.duration,

    // 导入专属
    columnMapping: task.params?.columnMapping,
    importStats: {
      total: executionResult.totalRows,
      success: executionResult.successRows,
      failed: executionResult.errorRows,
      reason: executionResult.errors?.length > 0 ? '唯一值冲突、必填字段为空、数据格式错误等' : '',
    },
    previewRows: executionResult.previewRows?.slice(0, 10),  // 前10行

    // 导出专属
    exportColumns: task.params?.columns,
    exportConfig: {
      headerType: task.params?.headerType,
      relationExportMode: task.params?.relationExportMode,
      exportAttachments: task.params?.exportAttachments,
      autoSplitSheet: task.params?.autoSplitSheet,
      format: 'xlsx',
      rowCount: executionResult.successRows,
    },
    relationDetails: executionResult.relationDetails,
    tableList: executionResult.tableList,

    // 错误日志
    errors: executionResult.errors?.slice(0, 100),  // 最多保留100条错误
  };
}
```

#### 错误报告导出（xlsx）

```typescript
// 在 tasks download action 中处理错误报告导出
async function exportErrorReport(errors: any[], outputPath: string): Promise<string> {
  const workbook = new Excel.stream.xlsx.WorkbookWriter({ filename: outputPath });
  const worksheet = workbook.addWorksheet('错误报告');

  worksheet.columns = [
    { header: '行号', key: 'row' },
    { header: '字段', key: 'field' },
    { header: '错误原因', key: 'message' },
    { header: '原始数据', key: 'data' },
  ];

  for (const error of errors) {
    worksheet.addRow({
      row: error.row,
      field: error.field,
      message: error.message,
      data: JSON.stringify(error.data),
    }).commit();
  }

  await worksheet.commit();
  await workbook.commit();
  return outputPath;
}
```

---

### 4.6 客户端 v2 设计

Block Models 和设置页注册保持不变。前端需实现的关键交互：

- **预览弹窗**：从已上传的 Excel 文件**实时读取前10行**（调用后端 API 解析）
- **附件模板下载**：从 `static/attachment-template.tar.gz` 下载预制模板
- **权限切换下拉**：分组显示用户权限和角色权限（两套独立）
- **更新/upsert 模式限制**：前端校验必须至少选1个唯一值字段
- **多对多空值策略**：更新模式下显示配置选项（清空关联/保留原关联）
- **任务详情抽屉**：所有数据从 `result` JSON 快照渲染，预览限制10行

---

## 五、完整流程

### 5.1 导入完整流程

```
用户操作                              服务端处理
────────                              ─────────
1. 选择目标数据表
2. 上传 Excel 文件
3. 选择权限配置（用户权限/角色权限，两套独立）
4. 配置导入模式（由权限决定，更新/upsert必须选唯一值）
5. 配置高级选项
   ├─ 空白值策略
   ├─ 唯一值字段（最多3个）
   ├─ 字段映射（Excel列/自定义/忽略）
   ├─ 多对多空值策略（clear/preserve）
   ├─ 附件 tar.gz（固定目录 attachments/）
   └─ 系统字段处理规则
6. 点击"执行导入"
   ──────────────────────────────>   7. 创建 sjgl02Tasks 记录（status=pending）
                                     8. 返回任务 ID
                                     9. 后台任务启动（status=running）
                                     10. FormatDetector 路由解析器
                                     11. 如有附件 tar.gz:
                                         ├─ tar-stream + gunzip-maybe 解压
                                         ├─ 只提取 attachments/ 目录文件
                                         └─ 路径穿越防护
                                     12. 逐行读取 Excel
                                     13. 系统字段处理
                                     14. 唯一值校验（含空值预检）
                                     15. 多对多关联处理（全量替换/保留）
                                     16. 事务处理（取消=全部回滚）
                                     17. 附件上传到 storage
                                     18. 进度推送（WebSocket 500ms）
                                     19. 完成 → 快照 result JSON
                                     20. 计算 duration
                                     21. 清理临时文件

7. 查看任务详情：
   ├─ 所有数据从 result JSON 快照读取
   ├─ 预览数据限制前10行
   └─ 错误报告可导出为 xlsx
```

### 5.2 导出完整流程

```
用户操作                              服务端处理
────────                              ─────────
1. 选择目标数据表
   ├─ admin/root: 全部数据表（含系统表、中间表）
   └─ 普通用户: 仅业务表
2. 选择导出字段
3. 配置列头格式
4. 配置关联表导出
   ├─ 单独Sheet / 单独xlsx文件
   └─ 关联表也超百万行分表（命名体现关联）
5. 配置数据范围
6. 点击"执行导出"
   ──────────────────────────────>   7. 创建 sjgl02Tasks 记录
                                     8. 后台任务启动
                                     9. 数据范围筛选
                                     10. 游标分页读取
                                     11. 流式写入 xlsx
                                         ├─ 关联表 separateSheet/separateFile
                                         ├─ 关联表分表命名：主表字段(标识)-关联表(标识)_N
                                         └─ 百万行分表
                                     12. 附件导出（tar.gz）
                                     13. 全部数据表模式：打包 tar.gz
                                     14. 完成 → 快照 result JSON
                                     15. 计算 duration

8. 下载结果
```

---

## 六、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| .xls 文件过大导致 OOM | 导入崩溃 | 硬限制 20 万行 |
| 严格模式大事务超时 | 导入失败 | 预校验 + 建议<50万行 |
| 大文件上传超时 | 导入失败 | 前端分片上传；调整超时配置 |
| 数据库连接池耗尽 | 其他请求阻塞 | 分块事务控制并发 |
| 临时文件堆积 | 磁盘满 | 30 分钟自动清理 |
| tar.gz 解压路径穿越 | 安全漏洞 | resolvePathWithinBase 防护 |
| tar.gz 目录结构不规范 | 附件找不到 | 固定目录名 `attachments/`，只提取该目录 |
| root 角色误分配 | 安全风险 | 仅 root 可分配 root |
| 取消任务数据残留 | 数据不一致 | 取消=全部回滚已写入数据 |
| 任务详情数据过期 | 文件被清理 | JSON 快照，不依赖原始文件 |
| 关联表数据量大 | 导出慢 | 关联表也分表，游标分页 |
| 权限配置删除后引用失效 | 导入失败 | 任务创建时快照权限配置到 params |

---

## 七、依赖清单

### 运行时依赖（peerDependencies）

```json
{
  "@nocobase/server": "*",
  "@nocobase/client-v2": "*",
  "@nocobase/flow-engine": "*",
  "@nocobase/plugin-async-task-manager": "*"
}
```

### 新增依赖（dependencies）

```json
{
  "exceljs": "^4.4.0",
  "xlsx": "^0.20.3",
  "@koa/multer": "^3.0.0",
  "multer": "^1.4.5-lts.1",
  "async-mutex": "^0.5.0",
  "tar-stream": "^3.1.7",
  "gunzip-maybe": "^1.4.2"
}
```

---

## 八、实施步骤

### Step 1：插件脚手架搭建

| 任务 | 产出 |
|------|------|
| 使用 `nb create-plugin sjgl02` 生成基础结构 | 基础文件结构 |
| 补全 v2 客户端结构 | 标准 v2 插件骨架 |
| 配置 `package.json` 依赖 | 可构建的包 |
| 创建 `static/attachment-template.tar.gz` | 预制附件导入模板 |
| 初始化 i18n 文件 | en-US / zh-CN |

### Step 2：服务端核心

| 任务 | 产出文件 |
|------|----------|
| 定义 `sjgl02Tasks` 集合（含 result JSON 快照、duration） | `collections/sjgl02Tasks.ts` |
| 定义 `sjgl02Permissions` 集合（roleName/userId） | `collections/sjgl02Permissions.ts` |
| 定义 `sjgl02PermissionLogs` 集合 | `collections/sjgl02PermissionLogs.ts` |
| 实现 Plugin 主类（资源注册、ACL、任务类型注册） | `plugin.ts` |
| 实现 import action（含权限校验、唯一值必选校验） | `actions/import.ts` |
| 实现 export action（含全部数据表导出） | `actions/export.ts` |
| 实现 tasks actions（list/detail/cancel/download） | `actions/tasks.ts` |
| 实现 permissions actions（CRUD + 自动日志） | `actions/permissions.ts` |
| 实现 permission-logs action（list） | `actions/permission-logs.ts` |

### Step 3：导入引擎

| 任务 | 产出文件 |
|------|----------|
| 格式路由（xlsx/xls/csv） | `services/format-detector.ts` |
| 权限切换服务（两套独立） | `services/permission-switcher.ts` |
| 系统字段处理 | `services/system-field-handler.ts` |
| 多对多关联处理（全量替换 + 空值策略） | `services/many-to-many-handler.ts` |
| StreamingImporter 主体 | `services/streaming-importer.ts` |
| 多字段组合唯一值校验 + 空值预检 | `services/unique-validator.ts` |
| 事务管理（取消=全部回滚） | `services/streaming-importer.ts`（内部） |

### Step 4：附件导入

| 任务 | 产出文件 |
|------|----------|
| tar.gz 解压（固定目录 `attachments/`，路径防护） | `services/attachment-importer.ts` |
| 附件上传到 storage + 关联 | 同上 |

### Step 5：导出引擎

| 任务 | 产出文件 |
|------|----------|
| StreamingExporter 主体 | `services/streaming-exporter.ts` |
| 字段名配置（三种列头） | 同上 |
| 数据范围筛选 | `services/data-filter-builder.ts` |
| 关联表导出（Sheet/文件，关联表也分表） | 同上 |
| 百万行自动分表（支持关联表分表命名） | `services/multi-sheet-writer.ts` |
| 全部数据表导出（含中间表） | `services/streaming-exporter.ts` |

### Step 6：附件导出

| 任务 | 产出文件 |
|------|----------|
| 附件收集 + tar.gz 打包 | `services/attachment-exporter.ts` |
| 错误报告导出（xlsx） | `services/streaming-exporter.ts` |

### Step 7：权限管理

| 任务 | 产出文件 |
|------|----------|
| （已去除：用户和角色来自NocoBase系统配置） | - |
| 权限配置 CRUD（roleName/userId） | `actions/permissions.ts` |
| 操作日志查询 | `actions/permission-logs.ts` |

### Step 8：v2 区块

| 任务 | 产出文件 |
|------|----------|
| ImportBlockModel（3步骤向导，权限切换两套独立，预览实时读取） | `models/ImportBlockModel.tsx` |
| ExportBlockModel（3步骤向导，关联表分表命名） | `models/ExportBlockModel.tsx` |
| TaskListBlockModel（9列表格，详情抽屉JSON快照，错误xlsx导出） | `models/TaskListBlockModel.tsx` |
| PermissionBlockModel（左右分栏，继承/自定义两套独立） | `models/PermissionBlockModel.tsx` |

### Step 9：设置页

| 任务 | 产出文件 |
|------|----------|
| 任务历史总览页面 | `pages/TaskHistoryPage.tsx` |
| 权限管理页面（含操作日志） | `pages/PermissionManagePage.tsx` |
| 导入导出默认配置页面 | `pages/ImportExportConfigPage.tsx` |

### Step 10：i18n + 代码规范 + 测试

| 任务 | 说明 |
|------|------|
| 补全 i18n | 所有用户可见字符串 |
| ESLint | `yarn eslint --fix` |
| 单元测试 | FormatDetector、UniqueValidator（含空值预检）、SystemFieldHandler、ManyToManyHandler、DataFilterBuilder、PermissionSwitcher |
| 集成测试 | xlsx/xls/csv 导入、空值预检、权限切换、系统字段处理、多对多全量替换、取消回滚、关联表分表、全部数据表导出、附件 tar.gz 导入导出、错误报告 xlsx 导出 |
| 端到端测试 | v2 完整流程 |

---

## 九、里程碑

| 里程碑 | 完成标准 |
|--------|----------|
| M1: 脚手架 | 插件可构建、可安装 |
| M2: 服务端核心 | 集合可同步、API 可调用 |
| M3: 导入引擎 | 三格式导入 + 权限切换 + 系统字段 + 多对多 |
| M4: 导入高级 | 事务 + 唯一校验 + 空值预检 + 取消回滚 + 附件 tar.gz |
| M5: 导出引擎 | 百万行导出 + 分表 + 数据范围 + 关联表分表 |
| M6: 导出高级 | 字段名配置 + 全部数据表导出 + 附件导出 + 错误xlsx |
| M7: 权限管理 | 权限CRUD + 操作日志（角色来自系统） |
| M8: v2 区块 | 四个区块 + 权限切换 + 实时预览 |
| M9: 设置页 | 任务历史 + 权限管理 + 配置 |
| M10: 交付 | i18n + ESLint + 测试通过 |

---

## 十、需求覆盖矩阵

| # | 需求 | 设计章节 | 状态 |
|---|------|----------|------|
| 1 | 导入支持 xlsx/xls(20万)/csv | 4.2.1 | ✅ |
| 2 | 失败全部回滚 | 4.2.7（严格模式） | ✅ |
| 3 | 唯一值多字段组合 | 4.2.6 | ✅ |
| 4 | 自定义内容填写 | 4.2.7 | ✅ |
| 5 | 附件通过 tar.gz 导入（固定目录 `attachments/`） | 4.2.8 | ✅ |
| 6 | Excel 空白值处理 | 4.2.9 | ✅ |
| 7 | admin/root 导出全部数据表（含系统表、含中间表） | 4.3.6 | ✅ |
| 8 | ~~admin/root 更换用户角色~~（已去除，角色来自系统配置） | - | ✅ 已去除 |
| 9 | 用户自定义权限（与继承权限两套独立） | 4.4.2 | ✅ |
| 10 | 导出字段名配置（三种） | 4.3.1 | ✅ |
| 11 | 关联表导出（Sheet/文件，关联表也分表） | 4.3.2 | ✅ |
| 12 | 附件导出（tar.gz） | 4.3.4 | ✅ |
| 13 | 导出格式仅 xlsx | 4.3 | ✅ |
| 14 | 超百万行自动分表 | 4.3.5 | ✅ |
| 15 | 导入时权限切换（两套独立） | 4.2.2 | ✅ |
| 16 | 空值唯一值预检 | 4.2.6 | ✅ |
| 17 | 系统字段处理 | 4.2.4 | ✅ |
| 18 | 数据范围筛选（AND多行） | 4.3.3 | ✅ |
| 19 | 权限操作日志 | 4.4.3 | ✅ |
| 20 | 任务详情抽屉（JSON快照） | 4.5 | ✅ |
| 21 | 权限编辑弹窗（780px） | 4.6 | ✅ |
| 22 | 任务表格9列（完成时间耗时改为悬停提示） | 4.1.1 | ✅ |
| 23 | 任务取消（全部回滚） | 4.2.7 | ✅ |
| 24 | 多对多关联全量替换 + 空值配置 | 4.2.5 | ✅ |
| 25 | 更新/upsert 必须选唯一值字段 | 4.2.3 | ✅ |
| 26 | 预览弹窗实时读取前10行 | 4.6 | ✅ |
| 27 | 附件模板预制 tar.gz | 4.2.8 | ✅ |
| 28 | 错误报告导出 xlsx | 4.5 | ✅ |
| 29 | 权限配置 roleName/userId | 4.4.1 | ✅ |
| 30 | 关联表分表命名体现关联关系 | 4.3.2 | ✅ |

---

*文档结束*