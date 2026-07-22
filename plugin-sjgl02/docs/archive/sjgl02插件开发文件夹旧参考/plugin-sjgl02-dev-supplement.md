# @my-project/plugin-sjgl02 开发补充文档

> 本文档为 `@my-project/plugin-sjgl02` 的开发补充说明，覆盖数据库集合定义、TypeScript 接口、API 接口、WebSocket 协议、前端组件设计与 i18n 清单。
>
> **命名约定**：
> - 数据库表名全部以 `sjgl02` 开头：`sjgl02Tasks`、`sjgl02Permissions`、`sjgl02PermissionLogs`
> - API 资源名全部 `sjgl02` 前缀
> - ACL snippet：`sjgl02.import`、`sjgl02.export`、`sjgl02.tasks`、`sjgl02.permission`

---

## 一、数据库集合定义

### 1.1 sjgl02Tasks（任务记录表）

```typescript
{
  name: 'sjgl02Tasks',
  title: '数据管理任务',
  fields: [
    { name: 'id', type: 'bigInt', primaryKey: true, autoIncrement: true },
    { name: 'type', type: 'string', allowNull: false, comment: 'import | export' },
    { name: 'status', type: 'string', allowNull: false, defaultValue: 'pending' },
    { name: 'collectionName', type: 'string', allowNull: false },
    { name: 'collectionTitle', type: 'string' },
    { name: 'params', type: 'json', allowNull: false },
    { name: 'result', type: 'json' },
    { name: 'duration', type: 'integer', comment: '毫秒' },
    { name: 'permissionConfigId', type: 'bigInt' },
    { name: 'permissionType', type: 'string', comment: 'user | role' },
    { name: 'filePath', type: 'string' },
    { name: 'fileName', type: 'string' },
    { name: 'fileSize', type: 'bigInt' },
    { name: 'errorReportPath', type: 'string' },
    { name: 'totalRows', type: 'integer', defaultValue: 0 },
    { name: 'successRows', type: 'integer', defaultValue: 0 },
    { name: 'errorRows', type: 'integer', defaultValue: 0 },
    { name: 'progress', type: 'integer', defaultValue: 0 },
    { name: 'progressCurrent', type: 'integer', defaultValue: 0 },
    { name: 'progressTotal', type: 'integer', defaultValue: 0 },
    { name: 'message', type: 'text' },
    { name: 'userId', type: 'bigInt' },
  ],
  createdBy: true, updatedBy: true, logging: true,
}
```

### 1.2 sjgl02Permissions（权限配置表）

```typescript
{
  name: 'sjgl02Permissions',
  title: '权限配置',
  fields: [
    { name: 'id', type: 'bigInt', primaryKey: true, autoIncrement: true },
    { name: 'targetType', type: 'string', allowNull: false, comment: 'user | role' },
    { name: 'targetId', type: 'string', allowNull: false, comment: 'roleName | userId' },
    { name: 'targetName', type: 'string' },
    { name: 'collectionName', type: 'string', allowNull: false },
    { name: 'collectionTitle', type: 'string' },
    { name: 'canImport', type: 'boolean', defaultValue: false },
    { name: 'canExport', type: 'boolean', defaultValue: false },
    { name: 'importModes', type: 'json', defaultValue: [] },
    { name: 'uniqueFields', type: 'json', defaultValue: [] },
    { name: 'requiredFields', type: 'json', defaultValue: [] },
    { name: 'importFields', type: 'json', defaultValue: [], comment: '空=全部允许' },
    { name: 'exportFields', type: 'json', defaultValue: [], comment: '空=全部允许' },
    { name: 'exportFilter', type: 'json', defaultValue: [] },
  ],
  createdBy: true, updatedBy: true, logging: true,
}
```

### 1.3 sjgl02PermissionLogs（权限操作日志表）

```typescript
{
  name: 'sjgl02PermissionLogs',
  title: '权限操作日志',
  fields: [
    { name: 'id', type: 'bigInt', primaryKey: true, autoIncrement: true },
    { name: 'action', type: 'string', allowNull: false, comment: 'create|update|destroy' },
    { name: 'targetType', type: 'string' },
    { name: 'targetId', type: 'string' },
    { name: 'targetName', type: 'string' },
    { name: 'collectionName', type: 'string' },
    { name: 'collectionTitle', type: 'string' },
    { name: 'permissionId', type: 'bigInt' },
    { name: 'beforeValue', type: 'json' },
    { name: 'afterValue', type: 'json' },
    { name: 'summary', type: 'string' },
    { name: 'userId', type: 'bigInt' },
  ],
  createdBy: true, logging: false,
}
```

---

## 二、TypeScript 接口定义

放置于 `src/shared/types.ts`（前后端共享）。

```typescript
// ========== 导入相关 ==========
interface Sjgl02ImportParams {
  dataSource: string;
  collection: string;
  format: 'xlsx' | 'xls' | 'csv';
  filePath: string;
  fileName: string;
  fileSize: number;
  sheetName: string;
  headerRow: number;
  permissionConfigId: string;
  permissionType: 'user' | 'role';
  updateMode: 'insert' | 'update' | 'upsert';
  columnMapping: ColumnMapping[];
  uniqueFields: string[];
  blankValueStrategy: 'skip' | 'clear';
  attachmentTarPath?: string;
  manyToManyEmptyStrategy?: 'clear' | 'preserve';
}

interface ColumnMapping {
  excelColumn: string;
  field: string;
  mode: 'excel' | 'custom' | 'ignore';
  customValue?: string;
}

// ========== 导出相关 ==========
interface Sjgl02ExportParams {
  dataSource: string;
  collection: string;
  columns: ExportColumn[];
  filter?: Record<string, unknown>;
  headerType: 'displayName_fieldName' | 'displayName' | 'fieldName';
  relationExportMode: 'separateSheet' | 'separateFile';
  relationFields: string[];
  exportAttachments: boolean;
  autoSplitSheet: boolean;
  dateFieldFormats?: Record<string, string>;
  includeSystemTables?: boolean;
  globalDateFormat?: string;
  globalRelationFormat?: string;
}

interface ExportColumn {
  dataIndex: string[];
  title: string;
  headerType: string;
  dateFormat?: string;
  relationExportValue?: 'displayValue' | 'primaryKey' | 'displayValueWithKey';
}

// ========== 权限配置 ==========
interface Sjgl02Permission {
  id: string;
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  collectionName: string;
  collectionTitle: string;
  canImport: boolean;
  canExport: boolean;
  importModes: ('insert' | 'update' | 'upsert')[];
  uniqueFields: string[];
  requiredFields: string[];
  importFields: string[];
  exportFields: string[];
  exportFilter?: { field: string; operator: string; value: string }[];
}

// ========== 任务结果快照 ==========
interface Sjgl02TaskResult {
  filePath?: string;
  downloadUrl?: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  sheetCount?: number;
  duration?: number;
  errors?: Sjgl02TaskError[];
  columnMapping?: ColumnMapping[];
  importStats?: { total: number; success: number; failed: number; reason: string };
  previewRows?: Record<string, unknown>[];
  exportColumns?: ExportColumn[];
  exportConfig?: Record<string, unknown>;
  relationDetails?: Sjgl02RelationDetail[];
  tableList?: { name: string; title: string; rowCount: number; hasAttachment: boolean }[];
}

interface Sjgl02TaskError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

interface Sjgl02RelationDetail {
  field: string;
  fieldId: string;
  type: 'm2o' | 'o2m' | 'm2m';
  target: string;
  targetTitle: string;
  displayField: string;
  exportValue: string;
  exportMode: string;
  sheetName: string;
  rowCount: number;
  through?: string;
}

// ========== 任务记录 ==========
interface Sjgl02Task {
  id: string;
  type: 'import' | 'export';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  collectionName: string;
  collectionTitle: string;
  params: Sjgl02ImportParams | Sjgl02ExportParams;
  result: Sjgl02TaskResult | null;
  duration: number;
  permissionConfigId: string;
  permissionType: 'user' | 'role';
  filePath: string;
  fileName: string;
  fileSize: number;
  errorReportPath: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  progress: number;
  progressCurrent: number;
  progressTotal: number;
  message: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ========== 权限操作日志 ==========
interface Sjgl02PermissionLog {
  id: string;
  action: 'create' | 'update' | 'destroy';
  targetType: 'user' | 'role';
  targetId: string;
  targetName: string;
  collectionName: string;
  collectionTitle: string;
  permissionId: string;
  beforeValue: Sjgl02Permission | null;
  afterValue: Sjgl02Permission | null;
  summary: string;
  userId: string;
  createdAt: string;
}
```

---

## 三、API 接口定义

### 3.1 导入相关

#### POST /api/sjgl02:import
- **权限**：sjgl02.import
- **Content-Type**：multipart/form-data
- **请求体**：file(文件) + body(JSON string)

```json
{
  "collection": "users", "format": "xlsx", "permissionConfigId": "1",
  "permissionType": "user", "updateMode": "upsert", "sheetName": "Sheet1",
  "headerRow": 1, "columnMapping": [{"excelColumn":"姓名","field":"nickname","mode":"excel"}],
  "uniqueFields": ["username"], "blankValueStrategy": "skip",
  "attachmentTarPath": "", "manyToManyEmptyStrategy": "preserve"
}
```
- **响应**：`{ "data": { "taskId": "123" } }`

#### POST /api/sjgl02:importUpload
- **权限**：sjgl02.import
- **请求体**：file(文件)
- **响应**：`{ "data": { "filePath":"...", "fileName":"...", "fileSize":102400, "sheets":[{name,headers,previewRows}] } }`

#### GET /api/sjgl02:previewExcel
- **权限**：sjgl02.import
- **参数**：filePath, sheetName, headerRow
- **响应**：`{ "data": { "headers":["姓名"], "rows":[...] } }`

#### GET /api/sjgl02:downloadTemplate
- **权限**：sjgl02.import
- **响应**：文件流（tar.gz）

#### GET /api/sjgl02:getImportPermissions
- **权限**：loggedIn
- **参数**：collection
- **响应**：`{ "data": { "userPermissions":[...], "rolePermissions":[...] } }`

### 3.2 导出相关

#### POST /api/sjgl02:export
- **权限**：sjgl02.export
- **请求体**：Sjgl02ExportParams（JSON）
- **响应**：`{ "data": { "taskId": "456" } }`

#### GET /api/sjgl02:getExportPermissions
- **权限**：loggedIn
- **参数**：collection
- **响应**：`{ "data": { "userPermissions":[...], "rolePermissions":[...] } }`

### 3.3 任务管理

| 接口 | 方法 | 权限 | 参数 | 响应 |
|------|------|------|------|------|
| /api/sjgl02Tasks:list | GET | sjgl02.tasks或自身 | page,pageSize,filter,sort | `{data:[...],meta:{...}}` |
| /api/sjgl02Tasks:get | GET | sjgl02.tasks或自身 | filterByTk | `{data:Sjgl02Task}` |
| /api/sjgl02Tasks:cancel | POST | sjgl02.tasks或自身 | `{filterByTk}` | `{data:{success:true}}` |
| /api/sjgl02Tasks:download | GET | sjgl02.tasks或自身 | filterByTk,type | 文件流 |

### 3.4 权限管理

| 接口 | 方法 | 权限 | 参数 | 响应 |
|------|------|------|------|------|
| /api/sjgl02Permissions:list | GET | sjgl02.permission | filter,page,pageSize | `{data:[...],meta:{...}}` |
| /api/sjgl02Permissions:create | POST | sjgl02.permission | Sjgl02Permission | `{data:Sjgl02Permission}` |
| /api/sjgl02Permissions:update | POST | sjgl02.permission | `{filterByTk,values}` | `{data:Sjgl02Permission}` |
| /api/sjgl02Permissions:destroy | POST | sjgl02.permission | `{filterByTk}` | `{data:{success:true}}` |
| /api/sjgl02PermissionLogs:list | GET | sjgl02.permission | filter,page,pageSize,sort | `{data:[...],meta:{...}}` |

### 3.5 ACL Snippet 映射

| ACL Snippet | 包含接口 |
|-------------|---------|
| sjgl02.import | sjgl02:import, sjgl02:importUpload, sjgl02:previewExcel, sjgl02:downloadTemplate, sjgl02:getImportPermissions |
| sjgl02.export | sjgl02:export, sjgl02:getExportPermissions |
| sjgl02.tasks | sjgl02Tasks:* |
| sjgl02.permission | sjgl02Permissions:*, sjgl02PermissionLogs:* |

---

## 四、WebSocket 进度推送协议

```
事件名：sjgl02:taskProgress
频道：sjgl02:taskProgress:{userId}

推送数据：
{
  taskId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  progress: { current: number; total: number };
  message?: string;
}

推送时机：
- 任务开始：status=running, progress={current:0,total:N}
- 进度更新：每500ms节流, status=running
- 任务完成：status=succeeded（立即推送）
- 任务失败：status=failed, message=错误信息（立即推送）
- 任务取消：status=canceled（立即推送）

后端实现：
- 任务执行循环中维护 current/total 计数器
- 每500ms节流向频道推送
- 终态立即推送不节流
- 同时更新sjgl02Tasks表的status/progress/message字段

前端订阅：
- 进入任务管理Tab时订阅
- 收到推送更新liveProgress Map
- 进度条实时更新，状态变更刷新统计
- 离开Tab时取消订阅
```

---

## 五、前端组件设计

### 5.1 FlowModel 注册

```typescript
async load() {
  this.flowEngine.registerModelLoaders({
    Sjgl02ImportBlockModel: { loader: () => import('./models/ImportBlockModel') },
    Sjgl02ExportBlockModel: { loader: () => import('./models/ExportBlockModel') },
    Sjgl02TaskListBlockModel: { loader: () => import('./models/TaskListBlockModel') },
    Sjgl02PermissionBlockModel: { loader: () => import('./models/PermissionBlockModel') },
  });
  this.pluginSettingsManager.addMenuItem({
    key: 'sjgl02-settings', title: this.t('数据管理'), icon: 'DatabaseOutlined', aclSnippet: 'sjgl02.tasks',
  });
  this.pluginSettingsManager.addPageTabItem({
    menuKey: 'sjgl02-settings', key: 'tasks', title: this.t('任务历史'),
    componentLoader: () => import('./pages/TaskHistoryPage'),
  });
  this.pluginSettingsManager.addPageTabItem({
    menuKey: 'sjgl02-settings', key: 'permissions', title: this.t('权限管理'),
    componentLoader: () => import('./pages/PermissionManagePage'), aclSnippet: 'sjgl02.permission',
  });
}
```

### 5.2 ImportBlockModel 状态

```typescript
interface ImportState {
  step: 0 | 1 | 2;
  selectedTable: string;
  selectedTableId: string;
  uploadedFile: { name: string; path: string; size: number };
  sheetName: string;
  headerRow: number;
  permissionConfigId: string;
  permissionType: 'user' | 'role';
  updateMode: 'insert' | 'update' | 'upsert';
  columnMapping: ColumnMapping[];
  uniqueFields: string[];
  blankValueStrategy: 'skip' | 'clear';
  attachmentTarPath?: string;
  manyToManyEmptyStrategy: 'clear' | 'preserve';
  availablePermissions: { userPermissions: Sjgl02Permission[]; rolePermissions: Sjgl02Permission[] };
  allowedImportFields: string[];
  previewRows: Record<string, unknown>[];
}
```

### 5.3 ExportBlockModel 状态

```typescript
interface ExportState {
  step: 0 | 1 | 2;
  selectedTable: string;
  isAllTablesMode: boolean;
  permissionConfigId: string;
  selectedFields: Set<string>;
  dateFieldFormats: Record<string, string>;
  relationExportValues: Record<string, 'displayValue' | 'primaryKey' | 'displayValueWithKey'>;
  relationExportFields: string[];
  relationExportMode: 'separateSheet' | 'separateFile';
  headerType: 'displayName_fieldName' | 'displayName' | 'fieldName';
  filterConditions: { field: string; operator: string; value: string }[];
  exportAttachments: boolean;
  globalDateFormat: string;
  globalRelationFormat: string;
}
```

### 5.4 TaskListBlockModel 状态

```typescript
interface TaskListState {
  tasks: Sjgl02Task[];
  total: number; page: number; pageSize: number;
  filter: { type?: string; status?: string; keyword?: string };
  stats: { total: number; completed: number; processing: number; pending: number; failed: number };
  liveProgress: Map<string, { current: number; total: number; status: string }>;
  drawerTask: Sjgl02Task | null;
  drawerVisible: boolean;
}
```

### 5.5 PermissionBlockModel 状态

```typescript
interface PermissionState {
  selectedTarget: { type: 'user' | 'role'; id: string; name: string };
  permissions: { inherited: Sjgl02Permission[]; custom: Sjgl02Permission[] };
  editModalVisible: boolean;
  editingPermission: Sjgl02Permission | null;
  logs: Sjgl02PermissionLog[];
  isAdmin: boolean;
}
```

### 5.6 关键交互逻辑

**权限切换联动**：
1. 选数据表后调用 `GET /api/sjgl02:getImportPermissions?collection=xxx`
2. 选中权限后：导入模式从importModes取(1个只读/多个可切换)，字段映射从importFields过滤(空=全部)，唯一值从uniqueFields预填，必填从requiredFields标记

**字段映射Excel列唯一选择**：
1. 维护 `usedExcelColumns: Set<string>`
2. 已用的选项disabled灰色
3. "清空匹配"清空所有，"自动匹配"按名称自动对应

**全选联动**：
1. 维护 checkedCount/totalCount
2. 全选按钮：0=未选, total=全选, 中间=半选(indeterminate)
3. 选中字段标签同步更新

**WebSocket进度推送**：
1. 进入任务管理Tab订阅 `sjgl02:taskProgress:{userId}`
2. 收到推送更新liveProgress Map
3. 进度条实时更新，状态变更刷新统计
4. 离开Tab取消订阅

---

## 六、i18n key 清单

### zh-CN.json

```json
{
  "数据管理":"数据管理","导入":"导入","导出":"导出","任务管理":"任务管理","权限管理":"权限管理",
  "选择数据表":"选择数据表","上传文件":"上传文件","配置映射":"配置映射","预览确认":"预览确认",
  "选择字段":"选择字段","权限切换":"权限切换","导入模式":"导入模式","空白字段处理":"空白字段处理",
  "唯一值字段":"唯一值字段","字段映射":"字段映射","附件导入":"附件导入","系统字段处理逻辑":"系统字段处理逻辑",
  "预计导入行数":"预计导入行数","错误行数":"错误行数","导入文件":"导入文件","导入数据表":"导入数据表",
  "导入的Sheet":"导入的Sheet","表头行":"表头行","事务模式":"事务模式","严格模式":"严格模式",
  "按Excel更新":"按Excel更新","不更新":"不更新","清空匹配":"清空匹配","自动匹配":"自动匹配",
  "下载附件模板":"下载附件模板","执行导入":"执行导入","任务已提交":"任务已提交",
  "请到任务管理查看":"请到任务管理查看","全部数据表":"全部数据表","含系统表":"含系统表",
  "表头格式":"表头格式","关联表导出":"关联表导出","单独Sheet":"单独Sheet","单独xlsx文件":"单独xlsx文件",
  "数据范围":"数据范围","全部数据":"全部数据","自定义条件":"自定义条件","导出附件":"导出附件",
  "导出格式":"导出格式","执行导出":"执行导出","任务总数":"任务总数","已完成":"已完成",
  "进行中":"进行中","排队中":"排队中","失败":"失败","查看":"查看","取消":"取消","下载":"下载",
  "关闭":"关闭","取消任务":"取消任务","重新导出":"重新导出","任务详情":"任务详情",
  "任务类型":"任务类型","目标数据表":"目标数据表","进度":"进度","创建人":"创建人",
  "创建时间":"创建时间","完成时间":"完成时间","耗时":"耗时","数据量":"数据量",
  "文件名":"文件名","文件大小":"文件大小","权限配置":"权限配置","全部日志":"全部日志",
  "成功":"成功","失败明细":"失败明细","导出错误报告":"导出错误报告","导出日志":"导出日志",
  "角色继承的权限":"角色继承的权限","用户自定义权限":"用户自定义权限","添加权限配置":"添加权限配置",
  "编辑":"编辑","删除":"删除","允许导入":"允许导入","允许导出":"允许导出",
  "必填字段":"必填字段","可导入字段":"可导入字段","可导出字段":"可导出字段",
  "导出范围筛选":"导出范围筛选","保存配置":"保存配置","操作日志":"操作日志",
  "操作人":"操作人","操作":"操作","变更概要":"变更概要","详情":"详情",
  "此角色拥有全部权限":"此角色拥有全部权限","无需配置":"无需配置",
  "任务查看范围":"任务查看范围","仅查看自己的":"仅查看自己的","查看全部":"查看全部",
  "日期时间导出格式":"日期时间导出格式","关联值导出格式":"关联值导出格式",
  "显示值":"显示值","主键值":"主键值","显示值+主键值":"显示值+主键值"
}
```

### en-US.json

```json
{
  "数据管理":"Data Management","导入":"Import","导出":"Export","任务管理":"Tasks","权限管理":"Permissions",
  "选择数据表":"Select Table","上传文件":"Upload File","配置映射":"Configure Mapping","预览确认":"Preview & Confirm",
  "选择字段":"Select Fields","权限切换":"Permission Switch","导入模式":"Import Mode","空白字段处理":"Blank Value Strategy",
  "唯一值字段":"Unique Fields","字段映射":"Field Mapping","附件导入":"Attachment Import","系统字段处理逻辑":"System Field Rules",
  "预计导入行数":"Estimated Rows","错误行数":"Error Rows","导入文件":"Import File","导入数据表":"Target Table",
  "导入的Sheet":"Sheet","表头行":"Header Row","事务模式":"Transaction Mode","严格模式":"Strict Mode",
  "按Excel更新":"Clear on Empty","不更新":"Keep Original","清空匹配":"Clear All","自动匹配":"Auto Match",
  "下载附件模板":"Download Template","执行导入":"Execute Import","任务已提交":"Task Submitted",
  "请到任务管理查看":"Check Tasks tab","全部数据表":"All Tables","含系统表":"Include System",
  "表头格式":"Header Format","关联表导出":"Relation Export","单独Sheet":"Separate Sheet","单独xlsx文件":"Separate File",
  "数据范围":"Data Range","全部数据":"All Data","自定义条件":"Custom Filter","导出附件":"Export Attachments",
  "导出格式":"Export Format","执行导出":"Execute Export","任务总数":"Total","已完成":"Completed",
  "进行中":"Processing","排队中":"Pending","失败":"Failed","查看":"View","取消":"Cancel","下载":"Download",
  "关闭":"Close","取消任务":"Cancel Task","重新导出":"Re-export","任务详情":"Task Details",
  "任务类型":"Type","目标数据表":"Table","进度":"Progress","创建人":"Creator",
  "创建时间":"Created","完成时间":"Completed","耗时":"Duration","数据量":"Data Volume",
  "文件名":"Filename","文件大小":"File Size","权限配置":"Permission Config","全部日志":"All Logs",
  "成功":"Success","失败明细":"Error Details","导出错误报告":"Export Error Report","导出日志":"Export Logs",
  "角色继承的权限":"Inherited Permissions","用户自定义权限":"Custom Permissions","添加权限配置":"Add Permission",
  "编辑":"Edit","删除":"Delete","允许导入":"Allow Import","允许导出":"Allow Export",
  "必填字段":"Required Fields","可导入字段":"Importable Fields","可导出字段":"Exportable Fields",
  "导出范围筛选":"Export Filter","保存配置":"Save","操作日志":"Activity Log",
  "操作人":"Operator","操作":"Action","变更概要":"Summary","详情":"Details",
  "此角色拥有全部权限":"Full Permissions","无需配置":"No Config Needed",
  "任务查看范围":"Task Scope","仅查看自己的":"Own Only","查看全部":"All",
  "日期时间导出格式":"Date Format","关联值导出格式":"Relation Format",
  "显示值":"Display Value","主键值":"Primary Key","显示值+主键值":"Display+Key"
}
```

---

## 七、权限校验流程

### 7.1 导入流程

1. 前端选数据表 -> 调用 `sjgl02:getImportPermissions` 获取可用权限配置
2. 选中权限后前端按 importModes/importFields/uniqueFields/requiredFields 渲染约束表单
3. 提交 `sjgl02:import` -> 后端二次校验：
   - 当前用户是否拥有该权限配置（防前端绕过）
   - updateMode 是否在 importModes 白名单内
   - columnMapping 中的 field 是否在 importFields 白名单内（空=全部）
   - uniqueFields 是否与权限配置一致
4. 校验通过 -> 创建 sjgl02Tasks 记录（快照params+permissionConfigId）-> 投递异步任务
5. 异步执行 -> 逐行校验requiredFields -> 按uniqueFields判断模式 -> 事务写入 -> 500ms推送进度
6. 完成 -> 写入result JSON快照 + 更新冗余统计字段 -> 推送终态

### 7.2 导出流程

1. 前端选数据表 -> 调用 `sjgl02:getExportPermissions` 获取可用权限配置
2. 选中权限后前端按 exportFields/exportFilter 渲染字段选择与范围筛选
3. 提交 `sjgl02:export` -> 后端二次校验：
   - 当前用户是否拥有该权限配置
   - columns 中的 field 是否在 exportFields 白名单内（空=全部）
   - 合并 exportFilter 到最终查询条件（前端不能绕过权限范围筛选）
4. 校验通过 -> 创建任务 -> 异步生成xlsx -> 完成 -> 写入result

### 7.3 任务可见性

- 拥有 sjgl02.tasks 权限：可查看全部任务
- 无 sjgl02.tasks 权限：后端自动按 userId=当前用户 过滤
- 取消/下载同理，非本人且无权限返回403

### 7.4 权限操作日志自动记录

在权限 CRUD 中通过钩子自动写入 sjgl02PermissionLogs：
- create：beforeValue=null, afterValue=完整配置, summary="为[类型][名称]创建了[表]的权限配置"
- update：记录前查询beforeValue, 更新后记录afterValue, summary自动diff
- destroy：beforeValue=删除前快照, afterValue=null

---

*文档结束*
