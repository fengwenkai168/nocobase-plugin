# CHANGELOG

## 1.0.27 (2026-06-29)

### 文档修正
- README.md：API 端点恢复准确（移除不存在的 upload/logs 端点、修正 preview 方法、更正数据模型字段和类型）、翻译键计数 92→115
- 产品文档.html：v3.8→v3.9，移除不存在的 API 端点（upload/logs/progress），修正所有数据模型字段和类型，修正实现说明
- CHANGELOG.md：补全 1.0.20~1.0.26 版本条目
- 修正 v1/v2 客户端版本号显示（v1.0.24 → v1.0.27）

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
