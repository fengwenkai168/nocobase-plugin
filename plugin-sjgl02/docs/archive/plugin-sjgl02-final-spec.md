# @my-project/plugin-sjgl02 最终规格文档（权威版）

> **版本**: v2.0.0 | **日期**: 2026-07-11
>
> **本文件是唯一权威开发依据**，取代以下三份历史文档的所有内容：
> - `plugin-sjgl02-功能确认.md`（v9）
> - `plugin-sjgl02-dev-plan.md`（v3.1）
> - `plugin-sjgl02-dev-supplement.md`
>
> 凡本文件与历史文档冲突，以本文件为准。历史冲突已全部消解，消解记录见附录 A。
>
> **代码行数约束**：所有源码文件（`.ts`/`.tsx`）**单文件不超过 500 行**。超过 500 行的模块必须拆分为子文件（如 `streaming-exporter.ts` 拆出 `relation-exporter.ts`、`multi-sheet-writer.ts`；`ImportBlockModel.tsx` 拆出步骤子组件）。这是硬性约束，开发时不得违反。

---

## 〇、核心决策记录（开发前必读）

以下决策已最终确认，不可再变更，后续设计均以此为准：

| # | 决策点 | 最终决定 | 依据 |
|---|--------|---------|------|
| D1 | 任务表架构 | **纯自建 `sjgl02Tasks` 表**，不关联 asyncTasks | 用户决定方案 B |
| D2 | 任务引擎 | **自建**进度推送/取消/排队/清理机制，不复用 `plugin-async-task-manager` 的 TaskType | 方案 B 的必然结果 |
| D3 | 主键类型 | `sjgl02Tasks.id` = **`bigInt autoIncrement`**；`sjgl02Permissions`/`sjgl02PermissionLogs` 同 | 跟随 NocoBase 业务表标准（users 模式），自建表不依赖 asyncTasks 的 uuid |
| D4 | 事务策略 | **单大事务严格模式**，失败全部 rollback，取消全部 rollback | 用户决定 |
| D5 | 导入行数上限 | **50 万行硬上限**，超限在提交时拒绝并提示分批；导出无限制 | 防止 PG 单大事务崩溃 |
| D6 | 客户端运行时 | **仅 v2**（`@nocobase/client-v2`），不实现 v1 | 不变 |
| D7 | 压缩格式 | 全部 **tar.gz**，附件固定目录 `attachments/` | 不变 |
| D8 | 目标表主键发现 | **动态发现**，不写死 `id`。使用 `collection.model.primaryKeyAttribute` / `primaryKeyAttributes` / `filterTargetKey` / `autoIncrementAttribute` 获取目标表实际的主键名称和类型 | NocoBase 支持 string/uuid/nanoid/snowflakeId/bigInt/integer 多种主键，复合主键，非 `id` 命名的主键，以及无主键的集合 |

### 关键风险声明（务必知悉）

- **D2 的代价**：选择自建任务引擎意味着必须自行实现：WebSocket 进度推送（500ms 节流）、任务取消信号、排队与并发控制、临时文件清理、（若多实例部署）跨实例分发。`plugin-async-task-manager` 的这些能力将**不被复用**。设计参照其实现模式，但不引其代码。
- **D4+D5 的边界**：50 万行是保守上限。严格模式下"百万级一次性导入"**不成立**——百万级必须分批（至少 2 批）。导出百万级无事务，不受限。
- **D4 的取消语义**：取消时若事务尚未 commit，执行 `transaction.rollback()` 即全部回滚；若已 commit 则无数据可回（严格模式只有最终一次 commit，中间不提交，所以取消必然在 commit 前，rollback 有效）。
- **D8 的边界**：目标数据表的主键可以是任意 NocoBase 支持的类型（bigInt / integer / string / uuid / nanoid / snowflakeId / uid），可以命名为任意字段名（不仅是 `id`），可以是复合主键（多个字段），甚至可以没有主键。插件必须通过 `collection.model.primaryKeyAttribute` 等 API 动态发现，绝不能写死 `id`。对于无主键的集合，导入仅支持 insert 模式，导出游标分页退化为 OFFSET。复合主键场景下 update/upsert 匹配和 m2o 关联处理均需适配。

---

## 一、整体布局

单一菜单"数据管理 sjgl02"进入一个页面，顶部 4 个 Tab：

| Tab | 说明 | 页面区块入口 | 设置中心入口 |
|-----|------|------------|------------|
| ⬇ 导入 | 3步骤向导导入数据 | ✅ | ✅ |
| ⬆ 导出 | 3步骤向导导出数据 | ✅ | ✅ |
| ☰ 任务管理 | 任务列表+详情 | ✅ | ✅ |
| ✓ 权限管理 | 用户/角色权限配置 | ❌ | ✅（仅admin/root） |

---

## 二、导入功能 - 3步骤向导

### 步骤①：选择数据表 & 上传文件

**左右两栏布局**：

| 左栏 - 选择数据表 | 右栏 - 上传文件 |
|------------------|----------------|
| 下拉搜索选择数据表 | 拖拽/点击上传 |
| 格式: 数据表名称(标识) | 支持 .xlsx(无限制)/.xls(≤20万)/.csv |
| 仅显示有权限导入的表 | 最大 50MB |
| 显示共多少张表可供选择 | 上传后显示文件名+大小 |

- "下一步"按钮在选了表+上传文件后激活
- 点击"下一步"进入步骤②

### 步骤②：配置映射

**顶部信息栏**：显示目标数据表名+上传文件名

**面板顺序**（从上到下）：

#### 1. Sheet & 表头设置
- Sheet名称下拉选择
- 表头行下拉选择（1/2/3）
- 🔄刷新按钮
- 👁预览前10行按钮（点击弹出预览弹窗，可切换Sheet，**从已上传的 Excel 文件实时读取前10行**）

#### 2. 权限切换（紫色左边框）
- 下拉选择本次导入使用的权限配置
- 分组显示：👤用户权限 / 🔐角色权限
- **角色继承权限和用户自定义权限是两套独立的存在**，互不覆盖。用户在此选择使用哪一套
- admin/root 可切换全部用户和角色的权限配置，普通用户只能切换自己的用户权限和所属角色权限
- 说明文字：选中权限配置后，下方"导入模式"自动锁定为该配置允许的模式。只有1个模式则只读不可切换，多个模式可切换。字段映射只显示该权限配置中"可导入"的字段。**唯一值字段同样受权限约束：权限配置已指定唯一值字段 → 预填并只读锁定；权限配置未指定 → 用户自由选择**

#### 3. 导入模式 + 空白字段处理（同一行左右布局）
- **导入模式**：下拉单选，由权限配置决定可用模式
  - 只有1个模式：只读不可切换，背景灰色
  - 多个模式：可下拉切换
  - 模式选项：新增(insert) / 更新(update) / 新增+更新(upsert)
  - **更新/upsert 模式必须至少选1个唯一值字段**，否则无法匹配已有记录
- **空白字段处理**：
  - ☑ 按Excel更新（清空）- 默认选中
  - ☐ 不更新（保留原值）

#### 4. 唯一值字段
- Tag交互：已选标签可删除，下拉已选灰化
- 最多3个字段，显示"已选 N/3 个"
- 字段显示格式：字段名称(字段标识)
- **两种状态（由权限配置决定）**：
  - **权限配置已指定唯一值字段** → 预填、**只读锁定**（Tag 灰色不可删除、下拉禁用），提示"由权限配置锁定"
  - **权限配置未指定（空）** → 用户自由选择，Tag 可增删
- 更新/新增+更新模式下唯一值字段为空 -> 整批回滚预检提示（黄色警告条）
- 空值唯一值预检：更新/upsert 模式下，任何行的唯一值字段为空 -> 整批回滚。系统在导入前会预检所有行的唯一值字段，发现空值立即终止并提示

#### 5. 字段映射
- 标题显示统计：共N列/已用N/剩余N
- 按钮：🗑清空匹配 / ⚡自动匹配
- 提示文字：在「Excel列」下拉中选择字段来源。选 Excel 列名则自动映射；选「自定义内容」可输入固定值；不选则为「忽略」。每个Excel列只能选一次，已选的变灰色
- 表格列：Excel列 | 映射方式 | -> | 数据表字段(表名-表标识) | 属性标签
- 映射方式标签：Excel列（蓝色）/ 固定值（绿色）/ 忽略（灰色）
- 数据表字段格式：字段名(标识) - 字段类型
- 属性标签：[主键:xxx]（金色，动态显示主键名如 `[主键:id]` `[主键:code]`）[唯一值]（橙色）[必填]（红色）[关联]（紫色）[附件]（青色）[系统字段]（灰色）
- 系统字段映射了Excel列时，行背景高亮蓝色，显示"⬆ Excel优先"标签

#### 6. 附件导入
- 开关：上传附件压缩包(tar.gz)
- 上传区域：点击上传，上传后显示文件名+大小
- **tar.gz 内部固定目录名为 `attachments/`**，所有附件文件放在该目录下
- 附件说明（6条规则）：
  1. 将所有附件文件放在 `attachments/` 文件夹中，然后压缩为 `tar.gz` 格式
  2. Excel 中附件列填写文件名（含扩展名），如 `photo1.jpg`
  3. 多个附件用逗号分隔，如 `photo1.jpg, doc.pdf`
  4. 系统会自动从 `attachments/` 目录中找到对应文件，上传并关联到数据行
  5. 压缩包内文件名必须与 Excel 中填写的文件名完全一致
  6. 支持的附件类型：图片(jpg/png/gif)、文档(pdf/doc/docx/xls/xlsx)、其他(zip/rar等)
- 📥下载附件压缩包模板按钮（**预制 tar.gz 文件**，含示例 Excel + 空 `attachments/` 文件夹，打包在插件中）

#### 7. NocoBase系统字段处理逻辑（可折叠，默认收起）
- 点击展开表格，展示各字段类型在新增/更新模式下的处理规则
- 系统字段(createdAt/updatedAt/createdById/updatedById)：默认忽略/保留，有Excel映射时按映射值写入
- **主键字段（动态发现，不写死 `id`）**：
  - 通过 `collection.model.primaryKeyAttribute` 获取目标表实际主键名（如 `id`、`code`、`uuid` 等）
  - 通过 `collection.getField(pkName)` 获取主键类型（bigInt / integer / string / uuid / nanoid / snowflakeId / uid）
  - **自增型（bigInt/integer autoIncrement）**：未映射时新增自动生成，Excel 映射时按映射值写入
  - **自动生成型（uuid/nanoid/snowflakeId/uid）**：未映射时由 field hook 自动生成，Excel 映射时按映射值写入
  - **手动型（string/非自增 integer）**：必须映射，不能为空（为空整批回滚），不能重复（与库中已有+本批次内重复整批回滚）
  - 更新/upsert 模式下未映射主键时，用唯一值字段组合匹配
  - **复合主键**（`filterTargetKey` 为数组）：所有主键字段必须一并映射或一并由唯一值字段替代
  - **无主键集合**：仅支持 insert 模式，不支持 update/upsert。导出时游标分页退化为 OFFSET 分页
- 各字段类型处理：
  - 单行文本/多行文本：直接写入/覆盖
  - 整数/数字：类型转换
  - 单选/多选：标签匹配
  - 布尔值：智能转换（true/false、是/否、1/0、启用/停用）
  - 日期时间：6种格式解析（标准/斜杠/纯日期/ISO8601/时间戳/Excel序列号）
  - 多对一(m2o)：**按目标表实际主键关联**（通过 `relationField.targetKey` 获取，不写死 `id`）
  - **一对多/多对多**：**全量替换**，Excel 中填多个主键ID逗号分隔（主键名按目标表实际 PK 字段名）。更新模式下如果 Excel 中多对多字段为空，**有配置选项**（清空关联 / 保留原关联）
  - 附件：从 tar.gz 的 `attachments/` 目录上传
  - 子表格/子表单：忽略
  - 公式/计算：忽略
- 全局规则：主键映射后可更新(不能为空不能重复)、唯一值字段匹配(为空整批回滚)、系统字段Excel映射优先

### 步骤③：预览 & 执行

**卡片网格**（12张确认卡片）：
1. 预计导入行数
2. 错误行数
3. 导入文件
4. 导入数据表
5. 导入的Sheet
6. 表头行
7. 导入模式
8. 唯一值
9. 附件
10. 空白值处理
11. 事务模式（严格模式-失败全部回滚）
12. 空值唯一值预检结果

**预览数据表格（前10行）**：
- 表头换行显示：导入:Excel列 -> 数据表:字段名(标识) - 类型 [标签]
- 数据行展示（前10行示例数据）

**执行导入**：点击后弹出确认弹窗 -> 确认后提交任务 -> 重置流程回到步骤①

---

## 三、导出功能 - 3步骤向导

### 步骤①：选择数据表

**左右两栏**：
- 左栏：下拉选择数据表（含"全部数据表（含系统表）"选项，仅admin/root可见）
- 右栏：简要配置说明
  - 支持全字段选择和自定义筛选
  - 关联字段可选择「显示值」或「仅ID」
  - 关联表可导出为单独Sheet或单独xlsx文件
  - 支持附件打包导出(tar.gz)
  - 超百万行自动分表
  - 导出格式固定 xlsx

### 步骤②：选择字段 & 配置

**单表模式 vs 全部数据表模式**：
- 全部数据表模式：显示蓝色提示卡片 + 全局日期格式配置 + 全局关联值格式配置，隐藏字段选择/关联表导出模式/数据范围
  - 全局日期时间导出格式：所有表的日期字段统一使用此格式（YYYY-MM-DD HH:mm:ss / YYYY/MM/DD HH:mm:ss / YYYY-MM-DD / UTC ISO 8601 / 时间戳(毫秒)）
  - 全局关联值导出格式：所有表的关联字段统一使用此格式（显示值(关联表字段名称) / 主键值(ID) / 显示值+主键值）
- 单表模式：显示完整配置（含权限切换）

**全部数据表导出说明**：
- **所有数据表都导出，包含中间表**（如 `usersTags` 等关联中间表）
- 每张表导出全部字段为独立 xlsx 文件，打包为 tar.gz 下载

**面板顺序**（单表模式）：

#### 1. 字段选择
- 全选复选框（联动：全选/反选/半选状态，已选数量实时更新）
- 分组显示：
  - 📄常规字段：字段名(标识) - 类型
  - 📅日期时间字段：勾选后显示格式下拉（YYYY-MM-DD HH:mm:ss / YYYY/MM/DD HH:mm:ss / YYYY-MM-DD / YYYY/MM/DD / UTC ISO 8601 / 时间戳(毫秒) / 时间戳(秒)）+ 预览
  - 🔗关联字段：字段名(标识) - 类型 -> 关联表(标识) 显示字段(字段名) [中间表:xxx] + 导出值下拉(显示值/主键值({实际PK名})/显示值+主键值)
  - 📎附件字段：字段名(标识) - 类型

#### 2. 关联表导出模式
- 多选Tag：选择需要导出的关联表
  - 蓝色Tag（多对一）：字段名(标识) -> 关联表(标识)
  - 紫色Tag（多对多含中间表）：字段名(标识) -> 关联表(标识) [中间表:xxx]
- 导出方式单选：
  - ☑ 关联表作为单独Sheet（默认）
  - ☐ 关联表作为单独xlsx文件（多个文件打包为tar.gz下载）
- Sheet命名格式：主表字段名称(主表字段标识)-关联表名称(关联表标识)，例: 角色(role)-角色(roles)
- **关联表超百万行也分表**，命名格式：主表字段名称(主表字段标识)-关联表名称(关联表标识)_序号，例: 角色(role)-角色(roles)_1、角色(role)-角色(roles)_2

#### 3. 表头格式
- ☑ 字段名称(字段名) 例: 地址(address) - 默认
- ☐ 字段名称 例: 地址
- ☐ 字段名 例: address

#### 4. 数据范围
- 全部数据 / 自定义条件（按钮切换）
- 自定义条件：AND多行筛选（字段+操作符+值），支持添加/删除条件行

#### 5. 高级选项
- 导出附件开关（打包tar.gz）
- 超百万行自动分表（默认开启，文字提示）
- 导出格式：xlsx（固定）

### 步骤③：执行导出

**单表模式**：9张确认卡片（选择字段数/预计行数/导出数据表/数据范围/表头格式/关联表导出/导出附件/百万行分表/导出格式）+ 选中字段标签 + 文件名
- 文件名格式：数据表名称-数据表标识-年月日时分秒.xlsx

**全部数据表模式**：6张卡片（导出表数量/预计总行数/导出范围/打包格式/导出附件/导出格式）+ 导出表清单标签（含中间表）+ 提示 + 文件名
- 文件名格式：全部数据表-年月日时分秒.tar.gz
- 每张表（含中间表）导出全部字段为独立 xlsx 文件，打包为 tar.gz 下载

**执行导出**：确认弹窗 -> 提交任务 -> 重置流程

---

## 四、任务管理

### 统计概览卡片（顶部）
**6张**，每张可点击快速筛选对应状态：任务总数 / 已完成 / 进行中 / 排队中 / 失败 / 已取消
（点击卡片 → 状态筛选自动切换，类型筛选重置为"全部"，搜索框清空）

### 筛选栏
- 任务类型：全部 / ⬇导入 / ⬆导出（**实际过滤表格行**，按钮高亮联动）
- 状态：全部 / ⏳排队 / 🔄进行 / ✅完成 / ❌失败 / 🚫已取消（**实际过滤表格行**，按钮高亮联动）
- 搜索框（实时 `oninput` 搜索表名/任务ID/创建人，即时过滤）
- **组合筛选**：类型 + 状态 + 搜索可叠加使用
- **空状态**：筛选无结果时显示 📭 "没有匹配的任务记录" 提示
- **分页信息**：动态更新 "共 N 条（每页 20 条）"

### 任务表格（9列）
| 任务ID | 类型 | 目标表 | 状态 | 进度 | 数据量 | 创建人 | 创建时间 | 操作 |
|--------|------|--------|------|------|--------|--------|----------|------|
- 状态：绿色圆点=完成 / 蓝色=进行中 / 红色=失败 / 橙色=排队中 / 灰色=已取消
- 进度：进度条+百分比（由 progressCurrent/progressTotal 计算）
- 操作：👁查看 / ⏹取消(进行中/排队) / ⬇下载(已完成导出)
- 点击行打开详情抽屉
- 完成时间+耗时：鼠标悬停行显示title提示

### 任务取消
- **取消后已写入的数据全部回滚**（严格模式下事务 rollback）
- 排队中的任务直接标记为 canceled
- 进行中的任务：设置取消信号 -> 任务执行循环检测信号 -> 执行 `transaction.rollback()` -> 标记为 canceled -> 清理临时文件
- **因严格模式只有最终一次 commit，取消必然发生在 commit 之前，rollback 可回滚全部已写入数据**
- **前端即时反馈**：点击取消 → 任务状态即时变更为"已取消"、统计卡片数字联动更新、若详情抽屉打开中则自动关闭

### 任务详情抽屉（1024px自适应宽度）

**整体视觉**：
- 内容区背景色：`#f5f7fa`
- 所有内容块用白色卡片包裹，圆角 10px，微阴影 `0 1px 2px rgba(0,0,0,0.04)`
- 卡片间距 16px，卡片内边距 20px 24px

**数据来源**：所有详情数据在任务完成时**快照存入 `sjgl02Tasks.result` JSON 字段**，不依赖原始文件。预览数据限制前10行。

**7个内容区块**：

#### 1. KPI指标卡片网格（9张卡片，CSS Grid自适应布局）
- 每卡片独立白色卡片（圆角10px，内边距14px 16px，微阴影）
- 标题12px `#8c8c8c` + 图标，值14px font-weight:600
- 状态值绿色 `#52c41a`，类型值蓝色 `#1677ff`
- 进度卡包含粗进度条（高6px，圆角3px，绿色渐变填充）
- 卡片点击不触发快捷筛选（仅任务列表页的统计卡片有此行为）
- 9个字段：任务类型 / 状态 / 目标数据表 / 进度（含进度条） / 创建人 / 创建时间 / 完成时间 / 耗时 / 数据量

#### 2. 任务配置详情
- 区块标题左侧带4px蓝色竖条 `#1677ff`
- 内容用**斑马纹列表**展示（border:1px solid #f0f0f0，圆角8px）：
  - 每行：左侧标签（width:120px，`#8c8c8c`，13px）+ 右侧值（`#1f1f1f`，14px，font-weight:500）
  - 奇数行背景 `#fafafa`，偶数行 `#fff`
  - 行高 44px，左右 padding 16px
  - 行之间 1px `#f0f0f0` 分隔线
- 11项：任务ID / 文件名 / 文件大小 / Sheet / 表头行 / 导入模式 / 唯一值字段 / 空白值处理 / 附件 / 权限配置 / 事务模式

#### 3. 导入任务专属
- 字段映射详情表：Excel列 | 映射方式 | 数据表字段(标识) - 类型 | 标签（白色卡片包裹）
- 导入统计：总行数 / 成功行数 / 失败行数 / 失败原因（斑马纹列表）
- 导入数据预览（前10行）：换行表头 导入:列 → 数据表:字段(标识)

#### 4. 导出任务专属
- 导出字段标签（白色卡片包裹）
- 导出配置：表头格式 / 关联表导出 / 导出附件 / 百万行分表 / 导出格式 / 导出行数（斑马纹列表）
- 关联表导出详情表：关联字段(标识) / 关联类型 / 关联表(标识) / 显示字段 / 导出值 / 导出方式 / Sheet名称 / 数据行数
- 多对多关联表导出提示（含中间表信息）
- 导出数据预览（前10行）

#### 5. 下载区
- 绿色调卡片（`background:#f0fdf4; border:1px solid #bbf7d0`），圆角10px
- 显示文件名+大小+生成时间
- ⬇下载导出文件按钮（已完成导出）
- ⬇下载导入源文件按钮（已完成导入）

#### 6. 全部日志
- 白色卡片包裹，带标题竖条
- 导入任务：
  - 成功/失败统计卡片 + 成功率
  - 失败明细表：行号 / 字段 / 错误原因 / 原始数据
  - 搜索框（搜索行号/字段）
  - 分页提示（显示前10条，共N条失败）
  - 📥**导出错误报告按钮（导出为 xlsx 格式）**
- 导出任务：
  - 导出成功统计卡片
  - 📥导出日志按钮

#### 7. 操作按钮
- ⏹取消任务（进行中/排队中，取消后全部回滚）
- 🔄重新导出（已完成导出）
- 关闭

---

## 五、权限管理

### 左侧栏（240px）
- 搜索框（实时过滤）
- 👤用户分组（3个）：头像(首字母)+用户名+角色信息
- 🔐角色分组（3个）：头像(R)+角色名(标识)

### 右侧内容区

**头部信息栏**：
- 选中目标标题：👤/🔐 名称 的权限配置 [用户/角色标签]
- 任务查看范围下拉（仅用户显示）：仅查看自己的 / 查看全部
- **+添加权限配置按钮**（蓝色主按钮，与任务查看范围同行右侧。admin/root 角色选中时隐藏）

**admin/root角色选中时**：
- 红色提示卡片：此角色拥有全部权限，无需配置
- 说明文字：admin/root 角色自动拥有所有数据表的导入、导出、全部模式、全部字段权限，包括系统表导出权限。不可修改、不可删除
- 权限标签
- 隐藏权限配置内容

**普通用户/角色选中时**：

**子Tab**：✓权限配置 / 📋操作日志(N条)

**权限配置**：
- 全选复选框 + 搜索框（搜索表名或标识）
- **📦角色继承的权限**（可折叠，N条）：灰色卡片，只读。来源于用户所属角色的权限配置，显示"查看详情"按钮
- **✏️用户自定义权限**（可折叠，N条）：白色卡片，可编辑/删除
- **两者是两套独立的存在，互不覆盖**。在导入/导出步骤②中通过"权限切换"下拉选择使用哪一套
- 每张卡片显示彩色标签：导入/导出/模式/唯一值/必填/可导入数/可导出数/筛选条件
- +添加权限配置按钮位于头部信息栏右侧（见上方"头部信息栏"）

**权限编辑弹窗（780px）**：
- 选择数据表（必填，下拉）
- 允许导入开关 / 允许导出开关（**联动显隐配置区**：开启→下方配置区展开，关闭→配置区收起隐藏。保存时根据开关状态决定是否应用对应配置）
- 导入配置区（蓝色边框，左侧3px蓝色条。仅导入开关开启时显示）：
  - 导入模式（可多选Tag）：新增(insert) / 更新(update) / 新增+更新(upsert)。每个Tag可 ✕ 删除。通过 `+ 添加模式` 按钮新增
  - 唯一值字段（update/upsert必填，Tag交互，下拉列表含主键字段并标注 `[主键]`）。每个Tag可 ✕ 删除，通过 `+ 添加字段` 新增
  - 必填字段（Tag交互），可增删
  - 可导入字段（空=全部允许，Tag交互），可增删
- 导出配置区（绿色边框，左侧3px绿色条。仅导出开关开启时显示）：
  - 可导出字段（空=全部允许，Tag交互），可增删
  - 导出范围筛选（可选，AND多行）：字段+操作符+值。每行支持 ✕ 删除，通过 `+ 添加筛选条件` 新增行
- 提示文字：* 开启导入/导出开关后，可配置对应的详细规则
- **保存行为**：关闭弹窗，Toast 显示完整的配置摘要（数据表、导入开关/模式、导出开关/字段、唯一值、必填字段）
- **编辑行为**：打开弹窗时若为编辑已有权限，预填已有配置数据；若为新增，表单为默认空状态

**操作日志**：
- 筛选条件：操作类型用**filter-btn按钮组**（全部/创建/修改/删除/切换），点击即时过滤表格行
- 统计：共 N 条记录
- 表格：时间 / 操作人 / 操作 / 目标 / 数据表 / 变更概要 / 详情（可展开）
- 操作标签：创建（绿色）/ 修改（橙色）/ 删除（红色）/ 切换（蓝色）
- 展开详情：显示操作前/操作后对比（JSON格式字段变更）
- **侧边栏搜索**：输入关键词实时过滤用户/角色列表（按名称和角色匹配）

---

## 六、命名格式规则

| 项目 | 格式 | 示例 |
|------|------|------|
| 单表导出文件名 | 数据表名称-数据表标识-年月日时分秒.xlsx | 订单表-orders-20260709153000.xlsx |
| 全部数据表导出包 | 全部数据表-年月日时分秒.tar.gz | 全部数据表-20260709153000.tar.gz |
| 关联表导出文件名 | 关联表名称-关联表标识-年月日时分秒.xlsx | 订单详情-orderItems-20260709153000.xlsx |
| 普通Sheet | 数据表名称 | 订单表 |
| 百万行分表Sheet | 数据表名称_序号 | 订单表_1、订单表_2 |
| 关联表Sheet | 主表字段名称(主表字段标识)-关联表名称(关联表标识) | 角色(role)-角色(roles) |
| 关联表分表Sheet | 主表字段名称(主表字段标识)-关联表名称(关联表标识)_序号 | 角色(role)-角色(roles)_1 |
| 附件压缩包 | tar.gz（固定目录名 `attachments/`） | attachments.tar.gz |
| 错误报告 | xlsx | 导入错误报告-20260709153000.xlsx |

**压缩格式**：全部使用 tar.gz，不使用 zip

---

## 七、数据库集合定义（最终统一版）

> **主键设计说明**：以下三张表是 sjgl02 自建表，统一采用 `bigInt autoIncrement` 主键（命名 `id`），遵循 NocoBase 业务表标准（与 `users` 集合一致）。对**目标数据表**（被导入/导出的表）的操作则**动态发现主键**（D8），通过 `collection.model.primaryKeyAttribute` / `filterTargetKey` 等 API 获取实际主键名称和类型，绝不写死 `id`。

### 7.1 任务记录表：`sjgl02Tasks`

```typescript
// src/server/collections/sjgl02Tasks.ts
export default {
  name: 'sjgl02Tasks',
  title: '数据管理任务',
  fields: [
    // 主键：bigInt 自增（NocoBase 业务表标准，遵循 users 集合模式）
    {
      name: 'id',
      type: 'bigInt',
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      uiSchema: { type: 'number', title: '{{t("ID")}}', 'x-component': 'InputNumber', 'x-read-pretty': true },
      interface: 'integer',
    },
    { name: 'type',            type: 'string',  allowNull: false, comment: 'import | export' },
    // status 统一为 string，值为：pending | running | succeeded | failed | canceled
    { name: 'status',          type: 'string',  allowNull: false, defaultValue: 'pending',
      comment: 'pending|running|succeeded|failed|canceled' },
    { name: 'title',           type: 'string' },
    { name: 'collectionName',  type: 'string',  allowNull: false },
    { name: 'collectionTitle', type: 'string' },
    {
      name: 'params',          type: 'json',    allowNull: false,
      comment: '导入/导出配置，结构见第八章',
    },
    {
      name: 'result',          type: 'json',
      comment: '任务完成时的完整快照，结构见第八章',
    },
    // 进度：原始 current/total，百分比由前端计算
    { name: 'progressTotal',   type: 'integer', defaultValue: 0 },
    { name: 'progressCurrent', type: 'integer', defaultValue: 0 },
    // 冗余统计字段（便于任务列表查询，值同步自 result）
    { name: 'totalRows',       type: 'integer', defaultValue: 0 },
    { name: 'successRows',     type: 'integer', defaultValue: 0 },
    { name: 'errorRows',       type: 'integer', defaultValue: 0 },
    // 文件相关
    { name: 'filePath',        type: 'string',  comment: '导入源文件或导出结果文件路径' },
    { name: 'fileName',        type: 'string' },
    { name: 'fileSize',        type: 'bigInt' },
    { name: 'errorReportPath', type: 'string',  comment: '错误报告 xlsx 路径' },
    // 时间
    { name: 'startedAt',       type: 'datetime' },
    { name: 'doneAt',          type: 'datetime' },
    { name: 'duration',        type: 'integer', comment: '毫秒' },
    // 权限快照
    { name: 'permissionConfigId', type: 'bigInt' },
    { name: 'permissionType',     type: 'string', comment: 'user | role' },
    { name: 'message',            type: 'text', comment: '错误/状态信息' },
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: false,
  logging: true,
} as CollectionOptions;
```

> **冲突消解说明**：历史文档 dev-plan 用 `uuid` 主键、supplement 用 `bigInt`。本版统一为 `bigInt autoIncrement`（D3）。supplement 中的冗余字段（filePath/fileSize/errorReportPath/totalRows/successRows/errorRows/permissionConfigId/permissionType）已**合并保留**，因任务列表/筛选需要按这些列查询，不应只放 JSON 里。dev-plan 的 `progressTotal/progressCurrent` 也保留。

### 7.2 权限配置表：`sjgl02Permissions`

```typescript
// src/server/collections/sjgl02Permissions.ts
export default {
  name: 'sjgl02Permissions',
  title: '数据管理权限配置',
  fields: [
    {
      name: 'id', type: 'bigInt', autoIncrement: true, primaryKey: true, allowNull: false,
      uiSchema: { type: 'number', title: '{{t("ID")}}', 'x-component': 'InputNumber', 'x-read-pretty': true },
      interface: 'integer',
    },
    { name: 'targetType',      type: 'string',  allowNull: false, comment: 'user | role' },
    // 角色权限: targetId = roleName（字符串，如 "admin"、"editor"）
    // 用户权限: targetId = userId（字符串形式的用户主键，与 users 集合主键对应）
    // targetId 使用 string 类型因为它是多态外键：同时引用角色名（string）和用户主键（bigInt→string）。string 是两者的最小公分母。
    { name: 'targetId',        type: 'string',  allowNull: false, comment: 'roleName | userId（多态外键，string 为最小公分母）' },
    { name: 'targetName',      type: 'string',  comment: '用户名称 或 角色名称（冗余，便于展示）' },
    { name: 'collectionName',  type: 'string',  allowNull: false },
    { name: 'collectionTitle', type: 'string' },
    { name: 'canImport',       type: 'boolean', defaultValue: false },
    { name: 'canExport',       type: 'boolean', defaultValue: false },
    { name: 'importModes',     type: 'json',    defaultValue: [], comment: '["insert","update","upsert"]' },
    { name: 'uniqueFields',    type: 'json',    defaultValue: [] },
    { name: 'requiredFields',  type: 'json',    defaultValue: [] },
    { name: 'importFields',    type: 'json',    defaultValue: [], comment: '空=全部允许' },
    { name: 'exportFields',    type: 'json',    defaultValue: [], comment: '空=全部允许' },
    { name: 'exportFilter',    type: 'json',    defaultValue: [], comment: '[{field,operator,value}]' },
    { name: 'sort',            type: 'integer', defaultValue: 0 },
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: true,
  logging: true,
} as CollectionOptions;
```

### 7.3 操作日志表：`sjgl02PermissionLogs`

```typescript
// src/server/collections/sjgl02PermissionLogs.ts
export default {
  name: 'sjgl02PermissionLogs',
  title: '权限操作日志',
  fields: [
    {
      name: 'id', type: 'bigInt', autoIncrement: true, primaryKey: true, allowNull: false,
      uiSchema: { type: 'number', title: '{{t("ID")}}', 'x-component': 'InputNumber', 'x-read-pretty': true },
      interface: 'integer',
    },
    // action 统一为：create | update | delete | toggle
    { name: 'action',          type: 'string',  allowNull: false, comment: 'create|update|delete|toggle' },
    { name: 'targetType',      type: 'string',  comment: 'user | role' },
    { name: 'targetId',        type: 'string',  comment: 'roleName | userId' },
    { name: 'targetName',      type: 'string' },
    { name: 'collectionName',  type: 'string' },
    { name: 'collectionTitle', type: 'string' },
    { name: 'permissionId',    type: 'bigInt',  comment: '关联 sjgl02Permissions.id' },
    { name: 'beforeValue',     type: 'json' },
    { name: 'afterValue',      type: 'json' },
    { name: 'summary',         type: 'text' },
    { name: 'createdById',     type: 'belongsTo', target: 'users' },
  ],
  createdBy: true,
  updatedBy: false,
  logging: false,
} as CollectionOptions;
```

> **冲突消解说明**：supplement 的 log action 值为 `create|update|destroy`，功能确认文档为 `创建/修改/删除/切换`。本版统一为 `create|update|delete|toggle`（destroy→delete 统一命名，新增 toggle 覆盖"切换"操作）。

---

## 八、JSON 字段结构定义

放置于 `src/shared/types.ts`（前后端共享）。

### 8.1 导入参数 `sjgl02Tasks.params`（type=import）

```typescript
interface Sjgl02ImportParams {
  dataSource: string;
  collection: string;
  format: 'xlsx' | 'xls' | 'csv';
  // 注意：filePath 在 sjgl02Tasks.filePath 列，此处不重复
  sheetName: string;
  headerRow: number;
  permissionConfigId: string;
  permissionType: 'user' | 'role';
  updateMode: 'insert' | 'update' | 'upsert';
  columnMapping: ColumnMapping[];
  uniqueFields: string[];          // 最多3个
  blankValueStrategy: 'skip' | 'clear';
  manyToManyEmptyStrategy: 'clear' | 'preserve';
  // 附件 tar.gz 路径（若上传了附件包）
  attachmentTarPath?: string;
  // 事务配置（固定严格模式，记录用于快照展示）
  transactionMode: 'strict';
}

interface ColumnMapping {
  excelColumn: string;
  field: string;
  mode: 'excel' | 'custom' | 'ignore';
  customValue?: string;            // mode='custom' 时填写
}
```

### 8.2 导出参数 `sjgl02Tasks.params`（type=export）

```typescript
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
  // 全部数据表模式
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
```

### 8.3 任务结果快照 `sjgl02Tasks.result`

```typescript
interface Sjgl02TaskResult {
  // 通用
  downloadUrl?: string;            // /api/sjgl02Tasks:download?filterByTk=xxx
  totalRows: number;
  successRows: number;
  errorRows: number;
  sheetCount?: number;
  duration?: number;               // 毫秒
  errors?: Sjgl02TaskError[];      // 最多保留100条

  // 导入专属
  columnMapping?: ColumnMapping[];
  importStats?: { total: number; success: number; failed: number; reason: string };
  previewRows?: Record<string, unknown>[];   // 前10行

  // 导出专属
  exportColumns?: ExportColumn[];
  exportConfig?: {
    headerType: string;
    relationExportMode: string;
    exportAttachments: boolean;
    autoSplitSheet: boolean;
    format: 'xlsx';
    rowCount: number;
  };
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
  through?: string;                // m2m 中间表
}

// ========== 主键发现（服务端工具类型，用于动态适配不同目标表的主键） ==========
interface PrimaryKeyInfo {
  /** 主键字段名；复合主键时返回第一个；无主键时为 null */
  name: string | null;
  /** 主键字段类型：bigInt | integer | string | uuid | nanoid | snowflakeId | uid | null */
  type: string | null;
  /** 是否自增（仅 bigInt/integer 可能为 true） */
  autoIncrement: boolean;
  /** 是否自动生成值（自增 || uuid || nanoid || snowflakeId || uid） */
  autoGenerate: boolean;
  /** 所有主键字段名列表（复合主键时多个）；无主键时为空数组 */
  primaryKeyNames: string[];
}
```

---

## 九、API 接口定义

> **命名约定**：API 资源名全部 `sjgl02` 前缀。ACL snippet：`sjgl02.import`、`sjgl02.export`、`sjgl02.tasks`、`sjgl02.permission`。

### 9.1 导入相关

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
  "manyToManyEmptyStrategy": "preserve", "transactionMode": "strict"
}
```
- **响应**：`{ "data": { "taskId": "123" } }`
- **后端校验**（提交时，在创建任务前）：
  1. 当前用户是否拥有该权限配置（防前端绕过）
  2. updateMode 是否在 importModes 白名单内
  3. columnMapping 中的 field 是否在 importFields 白名单内（空=全部）
  4. uniqueFields 校验：若权限配置已指定 uniqueFields → 提交值必须完全一致（防前端绕过锁定）；若权限配置未指定 → 接受用户选择的值
  5. **50 万行预检**：解析文件获取总行数，超过 500000 返回 400：`严格模式单次导入上限 50 万行，当前 N 行，请分批导入`
  6. update/upsert 模式 uniqueFields 不能为空
  7. 空值唯一值预检：所有行的唯一值字段不能为空

#### POST /api/sjgl02:importUpload
- **权限**：sjgl02.import
- **请求体**：file(文件)
- **响应**：`{ "data": { "filePath":"...", "fileName":"...", "fileSize":102400, "sheets":[{"name":"Sheet1","headers":["姓名"],"previewRows":[...]}] } }`

#### GET /api/sjgl02:previewExcel
- **权限**：sjgl02.import
- **参数**：filePath, sheetName, headerRow
- **响应**：`{ "data": { "headers":["姓名"], "rows":[...] } }`

#### GET /api/sjgl02:downloadTemplate
- **权限**：sjgl02.import
- **响应**：文件流（tar.gz 预制模板）

#### GET /api/sjgl02:getImportPermissions
- **权限**：loggedIn
- **参数**：collection
- **响应**：`{ "data": { "userPermissions":[...], "rolePermissions":[...] } }`

### 9.2 导出相关

#### POST /api/sjgl02:export
- **权限**：sjgl02.export
- **请求体**：Sjgl02ExportParams（JSON）
- **响应**：`{ "data": { "taskId": "456" } }`
- **后端校验**：
  1. 当前用户是否拥有该权限配置
  2. columns 中的 field 是否在 exportFields 白名单内（空=全部）
  3. 合并 exportFilter 到最终查询条件（前端不能绕过权限范围筛选）
  4. 全部数据表模式校验 admin/root 权限

#### GET /api/sjgl02:getExportPermissions
- **权限**：loggedIn
- **参数**：collection
- **响应**：`{ "data": { "userPermissions":[...], "rolePermissions":[...] } }`

### 9.3 任务管理

| 接口 | 方法 | 权限 | 参数 | 响应 |
|------|------|------|------|------|
| /api/sjgl02Tasks:list | GET | sjgl02.tasks或自身 | page,pageSize,filter,sort | `{data:[...],meta:{...}}` |
| /api/sjgl02Tasks:get | GET | sjgl02.tasks或自身 | filterByTk | `{data:Sjgl02Task}` |
| /api/sjgl02Tasks:cancel | POST | sjgl02.tasks或自身 | `{filterByTk}` | `{data:{success:true}}` |
| /api/sjgl02Tasks:download | GET | sjgl02.tasks或自身 | filterByTk,type | 文件流（`ctx.body = fs.createReadStream(path)`） |
| /api/sjgl02Tasks:exportErrorReport | GET | sjgl02.tasks或自身 | filterByTk | xlsx 文件流（`ctx.body = fs.createReadStream(path)`） |

> **文件下载实现**：所有下载端点必须用 `ctx.body = fs.createReadStream(filePath)` 流式输出，**不用 `fs.readFileSync`**。spike 验证：27 MB 文件 readFileSync 峰值 290 MB，createReadStream 峰值 247 MB；全部数据表导出可能数百 MB，readFileSync 会 OOM。

**任务可见性**：
- 拥有 sjgl02.tasks 权限：可查看全部任务
- 无 sjgl02.tasks 权限：后端自动按 createdById=当前用户 过滤
- 取消/下载同理，非本人且无权限返回 403

### 9.4 权限管理

| 接口 | 方法 | 权限 | 参数 | 响应 |
|------|------|------|------|------|
| /api/sjgl02Permissions:list | GET | sjgl02.permission | filter,page,pageSize | `{data:[...],meta:{...}}` |
| /api/sjgl02Permissions:create | POST | sjgl02.permission | Sjgl02Permission | `{data:Sjgl02Permission}` |
| /api/sjgl02Permissions:update | POST | sjgl02.permission | `{filterByTk,values}` | `{data:Sjgl02Permission}` |
| /api/sjgl02Permissions:destroy | POST | sjgl02.permission | `{filterByTk}` | `{data:{success:true}}` |
| /api/sjgl02PermissionLogs:list | GET | sjgl02.permission | filter,page,pageSize,sort | `{data:[...],meta:{...}}` |

**操作日志自动记录**（在权限 CRUD 中通过钩子）：
- create：beforeValue=null, afterValue=完整配置, summary="为[类型][名称]创建了[表]的权限配置"
- update：记录前查询 beforeValue, 更新后记录 afterValue, summary 自动 diff
- delete：beforeValue=删除前快照, afterValue=null

### 9.5 ACL Snippet 映射

| ACL Snippet | 包含接口 |
|-------------|---------|
| sjgl02.import | sjgl02:import, sjgl02:importUpload, sjgl02:previewExcel, sjgl02:downloadTemplate, sjgl02:getImportPermissions |
| sjgl02.export | sjgl02:export, sjgl02:getExportPermissions |
| sjgl02.tasks | sjgl02Tasks:* |
| sjgl02.permission | sjgl02Permissions:*, sjgl02PermissionLogs:* |

---

## 十、任务引擎设计（自建，方案 B）

> **本章节为新增**。因 D1/D2 决定纯自建，不复用 `plugin-async-task-manager`，必须自建任务引擎。设计参照 async-task-manager 的实现模式。

### 10.1 任务引擎职责

| 能力 | 实现方式 |
|------|---------|
| 任务排队 | 内存队列 + 并发控制（默认并发 1，可通过环境变量 `SJGL02_TASK_CONCURRENCY` 配置） |
| 进度推送 | WebSocket `ws:sendToUser`，500ms 节流（lodash throttle，leading+trailing） |
| 任务取消 | 取消标志位 + AbortController，执行循环每批检测信号 |
| 临时文件清理 | 任务完成 30 分钟后自动清理 filePath 指向的临时文件 |
| 状态机 | pending -> running -> succeeded/failed/canceled |

### 10.2 任务状态机

```
pending（排队中）
   │ 调度器取出任务
   ▼
running（进行中）
   │
   ├──成功──> succeeded
   ├──失败──> failed（事务 rollback）
   └──取消──> canceled（事务 rollback）
```

status 字段值为字符串：`pending | running | succeeded | failed | canceled`

### 10.3 进度推送协议

```
WebSocket 事件名：sjgl02:taskProgress
频道：sjgl02:taskProgress:{userId}

推送数据：
{
  taskId: number;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
  progress: { current: number; total: number };
  message?: string;
}

推送时机：
- 任务开始：status=running, progress={current:0,total:N}
- 进度更新：每500ms节流, status=running
- 任务完成：status=succeeded（立即推送，不节流）
- 任务失败：status=failed, message=错误信息（立即推送）
- 任务取消：status=canceled（立即推送）

前端订阅：
- 进入任务管理Tab时订阅 sjgl02:taskProgress:{userId}
- 收到推送更新 liveProgress Map
- 进度条实时更新，状态变更刷新统计
- 离开Tab时取消订阅
```

### 10.4 事务与取消实现（严格模式，单大事务）

```typescript
// src/server/services/streaming-importer.ts（核心逻辑）

class StreamingImporter {
  private canceled = false;
  private transaction: Transaction | null = null;

  /**
   * 严格模式：单大事务
   * - 全部行在同一事务内写入
   * - 只有最终一次 commit
   * - 任何错误或取消 -> rollback 全部
   *
   * 50 万行硬上限在 action 层预检，此处不重复检查
   */
  async execute(task: Sjgl02Task): Promise<Sjgl02TaskResult> {
    const targetCollection = this.db.getCollection(task.params.collection);
    const pkInfo = resolvePrimaryKey(targetCollection);   // 动态发现主键（D8）

    // 无主键集合仅支持 insert
    if (!pkInfo.name && task.params.updateMode !== 'insert') {
      throw new Error('无主键集合仅支持新增(insert)模式');
    }

    this.transaction = await this.db.sequelize.transaction();
    try {
      // === WorkbookReader 逐行流式读取（spike 验证：50 万行峰值 649 MB） ===
      const reader = new Excel.stream.xlsx.WorkbookReader(task.params.filePath, {
        sharedStrings: 'cache',   // 需缓存共享字符串才能正确解析文本
        worksheets: 'emit',
        hyperlinks: 'ignore',
        styles: 'ignore',
        entries: 'ignore',
      });

      let batchValues: any[] = [];
      const batchSize = 5000;
      let rowNum = 0;
      let firstSheet = true;

      for await (const worksheetReader of reader) {
        if (!firstSheet) break;  // 只处理第一个 sheet
        firstSheet = false;

        for await (const row of worksheetReader) {
          rowNum++;
          if (rowNum === 1) continue;  // 跳过表头

          // 每行检测取消信号
          if (this.canceled) {
            await this.transaction.rollback();
            return { status: 'canceled' };
          }

          const values = this.processRow(row.values, task.params);

          // 主键处理（动态适配，不写死 id）
          const pkMapped = task.params.columnMapping.some(m => m.field === pkInfo.name);
          if (!pkMapped) {
            if (pkInfo.autoGenerate) {
              delete values[pkInfo.name];  // 自增/UUID/nanoid 等自动生成
            } else if (task.params.updateMode !== 'update') {
              throw new Error(`主键字段 "${pkInfo.name}" 未映射且不可自动生成`);
            }
          }

          batchValues.push(values);

          // 批量写入（同事务内，每 5000 行一次 bulkCreate）
          if (batchValues.length >= batchSize) {
            await this.batchWrite(targetCollection, batchValues, task.params, pkInfo, this.transaction);
            batchValues = [];
            this.reportProgress();
          }
        }
      }

      // 处理剩余行
      if (batchValues.length > 0) {
        await this.batchWrite(targetCollection, batchValues, task.params, pkInfo, this.transaction);
      }

      // 全部行写入成功，最终提交
      await this.transaction.commit();

      // 导入完成后重置自增序列（参照 plugin-action-import）
      await this.resetAutoIncrementSequence(targetCollection);

      return { status: 'succeeded', ... };
    } catch (error) {
      // 任何错误 -> 全部回滚
      await this.transaction.rollback();
      throw error;
    }
  }

  /**
   * 构建匹配条件：优先用主键值，其次用唯一值字段组合
   */
  private buildMatchCondition(
    values: Record<string, unknown>,
    pkInfo: PrimaryKeyInfo,
    params: Sjgl02ImportParams,
  ): Record<string, unknown> {
    // 如果 Excel 中映射了主键 → 用主键值匹配
    if (pkInfo.name && values[pkInfo.name] != null) {
      return { [pkInfo.name]: values[pkInfo.name] };
    }
    // 否则用唯一值字段组合匹配
    const where: Record<string, unknown> = {};
    for (const uf of params.uniqueFields) {
      where[uf] = values[uf];
    }
    return where;
  }

  /**
   * 取消：设置标志位，执行循环在下一次迭代检测并 rollback
   */
  async cancel(): Promise<void> {
    this.canceled = true;
    // 若事务存在且未提交，循环退出时会 rollback
    // 若任务还在 pending（未开始），直接标记 canceled
  }
}
```

> **关键点**：严格模式下事务只 commit 一次（全部行写完后），因此取消发生在 commit 之前时，rollback 可回滚全部已写入数据。不存在"已提交块需补偿删除"的问题--那是分块提交策略才需要的，本规格不采用。
>
> **spike 实测数据**（PostgreSQL 16，50 万行）：
> - 写入耗时 33.9s，commit 5ms，**rollback 仅 9ms**
> - rollback 极快是因为事务未 commit，PG 只需标记 aborted，不逐行回滚
> - WorkbookReader 读取内存峰值 649 MB（V1 `workbook.xlsx.read` 峰值 1,671 MB，2 GB 服务器会 OOM）
> - 导出 100 万行内存增长仅 58 MB（`chunkWithCursor` + `WorkbookWriter`）
>
> 详细数据见 `spike-results.md`
>
> **主键适配关键逻辑**：
> 1. 通过 `resolvePrimaryKey(collection)` 获取目标表实际主键信息（名称、类型、是否自增/自动生成）
> 2. 写入新行时：自增型/自动生成型 PK 若 Excel 未映射则删除该字段让 DB/hook 自动生成；手动型 PK 必须映射
> 3. update/upsert 匹配时：优先用 Excel 中映射的主键值，否则用唯一值字段组合
> 4. m2o 关联字段处理时用 `relationField.targetKey` 获取关联目标表的主键名，绝不写死 `id`

### 10.5 导出引擎（无事务，流式）

```typescript
class StreamingExporter {
  /**
   * 导出无事务，游标分页读取，流式写入 xlsx
   * 百万行不受限
   */
  async execute(task: Sjgl02Task): Promise<Sjgl02TaskResult> {
    const targetCollection = this.db.getCollection(task.params.collection);
    const pkInfo = resolvePrimaryKey(targetCollection);  // 动态发现主键（D8）

    // 游标分页：用实际主键做排序，避免 OFFSET 深度分页
    // 无主键集合退化为 OFFSET 分页
    const sortField = pkInfo.name ?? targetCollection.model.rawAttributes['id']?.field;
    const cursor = this.buildCursor(task.params, sortField);
    const writer = new Excel.stream.xlsx.WorkbookWriter({ filename: outputPath });

    let current = 0;
    const total = await this.countRows(task.params);

    for await (const batch of cursor) {
      if (this.canceled) {
        await writer.commit();  // 关闭流
        await fs.unlink(outputPath);  // 删除半成品
        return { status: 'canceled' };
      }

      for (const row of batch) {
        writer.addRow(this.transformRow(row, task.params));
        current++;
      }
      this.reportProgress(current, total);
    }

    await writer.commit();
    return { status: 'succeeded', filePath: outputPath, ... };
  }

  /**
   * 构建游标查询：用目标表实际主键做排序字段
   * 无主键时退化为按 OFFSET 分页
   */
  private buildCursor(params: Sjgl02ExportParams, sortField: string | null) {
    const findOptions: any = {
      filter: params.filter,
      limit: 1000,
    };
    if (sortField) {
      findOptions.sort = [sortField, 'ASC'];
    }
    return this.db.getRepository(params.collection).find(findOptions);
  }
}
```

---

## 十一、技术方案

### 11.1 关键技术选型

| 技术点 | 方案 | 原因 |
|--------|------|------|
| **xlsx 解析（导入）** | **ExcelJS `WorkbookReader` 异步迭代器** | 逐行 `for await` 迭代，50 万行内存峰值约 650 MB。**不用 `workbook.xlsx.read`**（全量加载，峰值 1.67 GB，2 GB 服务器 OOM）。spike 验证：V2 比 V1 降 61% 内存，代价仅慢 22% |
| xls 解析 | SheetJS (`xlsx` 库) `XLSX.read` | ExcelJS 不支持 .xls；SheetJS 全量读入内存，因此限制 20 万条 |
| csv 解析 | `csv-parse` 流式逐行读取 | 逐行读取，内存恒定 |
| tar.gz 解压 | `tar-stream` + `zlib.createGunzip()` | 流式处理，内存可控；路径穿越防护 |
| tar.gz 打包 | `tar-stream` + `zlib.createGzip()` | 流式打包 |
| 数据库分页（导出） | `repo.chunkWithCursor` 游标分页 | 避免 OFFSET 深度分页性能退化；spike 验证 100 万行内存增长仅 58 MB |
| 任务引擎 | **自建**（队列 + WebSocket + AbortController） | D2 决定不复用 async-task-manager |
| 文件写入（导出） | ExcelJS `stream.xlsx.WorkbookWriter`（`useSharedStrings: false`） | 流式写入临时文件，不占内存 |
| 文件下载 | `ctx.body = fs.createReadStream(path)` | **不用 `readFileSync`**（全量进内存）；spike 验证流式下载内存更低 |
| 进度推送 | WebSocket（ws:sendToUser） | 实时进度，500ms 节流 |
| 客户端框架 | FlowModel（v2） | 符合 NocoBase v2 架构 |
| 错误报告 | ExcelJS `WorkbookWriter` 生成 xlsx | 与导出格式一致，流式写入 |
| **主键发现** | **`resolvePrimaryKey(collection)`** | D8：动态获取目标表主键名/类型/自增/自动生成属性，适配所有 NocoBase 支持的主键类型 |

### 11.2 依赖清单

**peerDependencies**：
```json
{
  "@nocobase/server": "*",
  "@nocobase/client-v2": "*",
  "@nocobase/flow-engine": "*"
}
```

**dependencies**（新增）：
```json
{
  "exceljs": "^4.4.0",
  "xlsx": "^0.20.3",
  "csv-parse": "^5.5.0",
  "@koa/multer": "^3.0.0",
  "multer": "^1.4.5-lts.1",
  "tar-stream": "^3.1.7",
  "lodash": "*"
}
```

> **冲突消解说明**：原 dev-plan 的 dependencies 含 `@nocobase/plugin-async-task-manager` 和 `async-mutex`、`gunzip-maybe`。本版移除 `plugin-async-task-manager`（D2 不复用），`gunzip-maybe` 改为 Node 内置 `zlib.createGunzip()`，`async-mutex` 不再需要（并发由自建队列管理，用简单信号量即可）。

### 11.3 现有能力复用（修正后）

| 来源 | 复用内容 | 用途 |
|------|----------|------|
| ~~`plugin-async-task-manager`~~ | ~~TaskType 基类~~ | **不再复用**（D2） |
| `plugin-action-export` | `SmartCursorBuilder`、ExcelJS 流式写入模式、**`isKeyField()` 动态主键检测模式** | 导出服务参考实现 + 主键发现参考 |
| `plugin-action-import` | `koa-multer` 上传、事务模式、**`autoIncrementAttribute` 自增列检测** | 导入服务参考实现 + 主键自适应参考 |
| `plugin-file-manager` | `uploadFile()`、`createFileRecord()`、`getFileStream()` | 附件导入上传、附件导出读取 |
| `plugin-backups` | 路径安全防护 `resolvePathWithinBase()` | 附件压缩包解压路径穿越防护 |
| `plugin-acl` | `roles`、`rolesUsers`、`rolesResourcesActions` 集合 | 角色/权限管理 |
| `@nocobase/client-v2` | `BlockModel`、`PluginSettingsManager` | v2 区块和设置页 |

---

## 十二、文件结构

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
│   ├── shared/
│   │   └── types.ts                       # 前后端共享 TS 接口（第八章）
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
│   │   ├── services/
│   │   │   ├── streaming-importer.ts      # 导入引擎（含事务+取消+动态主键适配）
│   │   │   ├── streaming-exporter.ts      # 导出引擎（游标+流式+动态主键排序）
│   │   │   ├── format-detector.ts         # xlsx/xls/csv 路由
│   │   │   ├── primary-key-resolver.ts    # 主键动态发现（D8，适配所有主键类型）
│   │   │   ├── permission-switcher.ts     # 权限切换（两套独立）
│   │   │   ├── system-field-handler.ts    # 系统字段处理
│   │   │   ├── many-to-many-handler.ts    # 多对多全量替换+空值策略
│   │   │   ├── unique-validator.ts        # 唯一值校验+空值预检
│   │   │   ├── attachment-importer.ts     # tar.gz 解压（固定目录 attachments/）
│   │   │   ├── attachment-exporter.ts     # 附件打包 tar.gz
│   │   │   ├── data-filter-builder.ts     # 导出数据范围筛选
│   │   │   ├── multi-sheet-writer.ts      # 百万行分表写入
│   │   │   ├── error-report-generator.ts  # 错误报告 xlsx 生成
│   │   │   └── temp-file-cleaner.ts       # 临时文件30分钟清理
│   │   └── task-engine/
│   │       ├── task-manager.ts            # 任务队列+调度+并发控制
│   │       ├── task-progress-emitter.ts   # WebSocket 500ms 节流推送
│   │       └── task-cancellation.ts       # 取消信号管理
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

> **新增 `task-engine/` 目录**：方案 B 自建任务引擎的三个核心文件。

---

## 十三、客户端 v2 设计

### 13.1 FlowModel 注册

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

### 13.2 BlockModel 状态定义

**ImportBlockModel**：
```typescript
interface ImportState {
  step: 0 | 1 | 2;
  selectedTable: string;
  uploadedFile: { name: string; path: string; size: number };
  sheetName: string;
  headerRow: number;
  permissionConfigId: string;
  permissionType: 'user' | 'role';
  updateMode: 'insert' | 'update' | 'upsert';
  columnMapping: ColumnMapping[];
  uniqueFields: string[];           // 权限已指定→预填只读；未指定→用户自由选择
  uniqueFieldsLocked: boolean;      // true=权限锁定只读，false=可自由编辑
  blankValueStrategy: 'skip' | 'clear';
  manyToManyEmptyStrategy: 'clear' | 'preserve';
  attachmentTarPath?: string;
  availablePermissions: { userPermissions: Sjgl02Permission[]; rolePermissions: Sjgl02Permission[] };
  allowedImportFields: string[];
  previewRows: Record<string, unknown>[];
}
```

**ExportBlockModel**：
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

**TaskListBlockModel**：
```typescript
interface TaskListState {
  tasks: Sjgl02Task[];
  total: number; page: number; pageSize: number;
  filter: { type?: string; status?: string; keyword?: string };
  stats: { total: number; completed: number; processing: number; pending: number; failed: number; canceled: number };
  liveProgress: Map<string, { current: number; total: number; status: string }>;
  drawerTask: Sjgl02Task | null;
  drawerVisible: boolean;
}
```

**PermissionBlockModel**：
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

### 13.3 关键交互逻辑

**权限切换联动**：
1. 选数据表后调用 `GET /api/sjgl02:getImportPermissions?collection=xxx`
2. 选中权限后：导入模式从 importModes 取（1个只读/多个可切换），字段映射从 importFields 过滤（空=全部），唯一值从 uniqueFields 取（有值则预填只读锁定，空则用户自由选择），必填从 requiredFields 标记

**字段映射 Excel 列唯一选择**：
1. 维护 `usedExcelColumns: Set<string>`
2. 已用的选项 disabled 灰色
3. "清空匹配"清空所有，"自动匹配"按名称自动对应

**全选联动**：
1. 维护 checkedCount/totalCount
2. 全选按钮：0=未选, total=全选, 中间=半选(indeterminate)
3. 选中字段标签同步更新

**WebSocket 进度推送**：
1. 进入任务管理 Tab 订阅 `sjgl02:taskProgress:{userId}`
2. 收到推送更新 liveProgress Map
3. 进度条实时更新，状态变更刷新统计
4. 离开 Tab 取消订阅

---

## 十四、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| .xls 文件过大导致 OOM | 导入崩溃 | 硬限制 20 万行 |
| **严格模式单大事务超时** | **导入失败** | **50 万行硬上限预检，超限拒绝要求分批（D5）** |
| 大文件上传超时 | 导入失败 | 前端分片上传；调整超时配置 |
| 数据库连接池耗尽 | 其他请求阻塞 | 单大事务只占一个连接；并发默认 1 |
| 临时文件堆积 | 磁盘满 | 30 分钟自动清理 |
| tar.gz 解压路径穿越 | 安全漏洞 | resolvePathWithinBase 防护 |
| tar.gz 目录结构不规范 | 附件找不到 | 固定目录名 `attachments/`，只提取该目录 |
| 取消任务数据残留 | 数据不一致 | 严格模式 rollback 全部（commit 前 rollback 有效） |
| 任务详情数据过期 | 文件被清理 | JSON 快照，不依赖原始文件 |
| 关联表数据量大 | 导出慢 | 关联表也分表，游标分页 |
| 权限配置删除后引用失效 | 导入失败 | 任务创建时快照权限配置到 params |
| **百万级导入** | **严格模式不支持一次性** | **必须分批，每批 ≤50 万行（D5）。这是设计约束非缺陷** |
| **目标表主键非标准（非 `id` 命名/非 bigInt 类型/复合主键/无主键）** | **导入/导出逻辑出错** | **D8：动态发现主键。无主键集合仅支持 insert；复合主键需映射全部 PK 字段；string/uuid/nanoid 等非自增型需 Excel 提供值。导出游标分页退化为 OFFSET** |

---

## 十五、需求覆盖矩阵

| # | 需求 | 设计章节 | 状态 |
|---|------|----------|------|
| 1 | 导入支持 xlsx/xls(20万)/csv | 11.1, 9.1 | ✅ |
| 2 | 失败全部回滚 | 10.4（严格模式单大事务） | ✅ |
| 3 | 唯一值多字段组合 | unique-validator | ✅ |
| 4 | 自定义内容填写 | columnMapping mode=custom | ✅ |
| 5 | 附件通过 tar.gz 导入（固定目录 `attachments/`） | attachment-importer | ✅ |
| 6 | Excel 空白值处理 | blankValueStrategy | ✅ |
| 7 | admin/root 导出全部数据表（含系统表、含中间表） | 9.2, streaming-exporter | ✅ |
| 8 | ~~admin/root 更换用户角色~~（已去除） | - | ✅ 已去除 |
| 9 | 用户自定义权限（与继承权限两套独立） | 五、权限管理 | ✅ |
| 10 | 导出字段名配置（三种） | headerType | ✅ |
| 11 | 关联表导出（Sheet/文件，关联表也分表） | 三、导出 | ✅ |
| 12 | 附件导出（tar.gz） | attachment-exporter | ✅ |
| 13 | 导出格式仅 xlsx | 11.1 | ✅ |
| 14 | 超百万行自动分表 | multi-sheet-writer | ✅ |
| 15 | 导入时权限切换（两套独立） | permission-switcher | ✅ |
| 16 | 空值唯一值预检 | unique-validator | ✅ |
| 17 | 系统字段处理 | system-field-handler | ✅ |
| 18 | 数据范围筛选（AND多行） | data-filter-builder | ✅ |
| 19 | 权限操作日志 | sjgl02PermissionLogs | ✅ |
| 20 | 任务详情抽屉（JSON快照） | 四、任务管理 | ✅ |
| 21 | 权限编辑弹窗（780px） | 五、权限管理 | ✅ |
| 22 | 任务表格9列 | 四、任务管理 | ✅ |
| 23 | 任务取消（全部回滚） | 10.4 | ✅ |
| 24 | 多对多关联全量替换 + 空值配置 | many-to-many-handler | ✅ |
| 25 | 更新/upsert 必须选唯一值字段 | 9.1 校验 | ✅ |
| 26 | 预览弹窗实时读取前10行 | 9.1 previewExcel | ✅ |
| 27 | 附件模板预制 tar.gz | static/ | ✅ |
| 28 | 错误报告导出 xlsx | error-report-generator | ✅ |
| 29 | 权限配置 roleName/userId | 7.2 | ✅ |
| 30 | 关联表分表命名体现关联关系 | 六、命名格式 | ✅ |
| **31** | **百万级导入行数上限** | **10.4, 14（50万硬上限）** | **✅ 新增** |
| **32** | **自建任务引擎** | **第十章** | **✅ 新增（D2）** |
| **33** | **目标表主键动态发现** | **D8, 二.7, 八.4, 十.4, 十.5, 十一.1** | **✅ 新增** |

---

## 十六、实施步骤

| Step | 任务 | 产出 |
|------|------|------|
| 1 | 插件脚手架搭建 | 基础文件结构 + package.json + i18n 初始化 |
| 2 | 三张集合定义 | collections/*.ts（第七章） |
| 3 | Plugin 主类（资源注册、ACL） | plugin.ts |
| 4 | **任务引擎**（自建） | task-engine/*.ts（第十章） |
| 5 | import action（含50万预检、权限校验） | actions/import.ts |
| 6 | 导入引擎（流式+事务+取消+**动态主键适配**） | services/streaming-importer.ts |
| 7 | 格式路由 + 系统字段 + 多对多 + 唯一校验 + **主键发现** | services/*.ts |
| 8 | 附件导入（tar.gz） | services/attachment-importer.ts |
| 9 | export action | actions/export.ts |
| 10 | 导出引擎（游标+流式+分表+**动态主键排序**） | services/streaming-exporter.ts |
| 11 | 关联表导出 + 数据范围 + 附件导出 | services/*.ts |
| 12 | 全部数据表导出（含中间表） | streaming-exporter.ts |
| 13 | tasks actions（list/get/cancel/download） | actions/tasks.ts |
| 14 | 错误报告生成 | services/error-report-generator.ts |
| 15 | permissions actions（CRUD + 自动日志） | actions/permissions.ts |
| 16 | permission-logs action | actions/permission-logs.ts |
| 17 | v2 四个 BlockModel | models/*.tsx |
| 18 | 设置页三个页面 | pages/*.tsx |
| 19 | i18n 补全 + ESLint | locale/*.json |
| 20 | 单元测试 + 集成测试 | __tests__/ |

---

## 附录 A：历史文档冲突消解记录

| # | 冲突点 | dev-plan (v3.1) | supplement | 本版决定 | 依据 |
|---|--------|-----------------|-----------|---------|------|
| C1 | sjgl02Tasks.id 类型 | `uuid` | `bigInt autoIncrement` | **`bigInt autoIncrement`** | D3：自建表用 NocoBase 业务表标准 |
| C2 | sjgl02Tasks 字段集 | 较少（progress/result/params） | 较多（含冗余列） | **合并，保留冗余列** | 任务列表需按列筛选，不应只放 JSON |
| C3 | 任务引擎来源 | 复用 async-task-manager TaskType | 未明确 | **自建** | D2：方案 B 不复用 |
| C4 | 事务策略 | 严格模式 + 建议<50万 + rollbackCommittedBlocks | 未明确 | **严格模式单大事务 + 50万硬上限 + rollback** | D4+D5 |
| C5 | 取消回滚实现 | 单事务rollback 与 块删除补偿 并存 | 未明确 | **仅单事务 rollback** | 严格模式只有一次 commit，取消在 commit 前 |
| C6 | status 类型 | `enum` 字符串 | 未明确（dev-plan 用字符串值） | **`string`，值 pending\|running\|succeeded\|failed\|canceled** | 自建引擎用字符串，不依赖 asyncTasks 的 integer |
| C7 | log action 值 | 未明确 | `create\|update\|destroy` | **`create\|update\|delete\|toggle`** | 统一命名，destroy→delete，新增 toggle |
| C8 | 依赖 async-mutex | 在 dependencies | - | **移除** | 并发由自建队列管理 |
| C9 | 依赖 gunzip-maybe | 在 dependencies | - | **移除，用 zlib.createGunzip()** | Node 内置即可 |
| C10 | 依赖 plugin-async-task-manager | 在 peerDependencies | - | **移除** | D2 不复用 |
| C11 | sjgl02Tasks.updatedBy | `false` | `true` | **`false`** | 任务记录创建后不应被业务修改，仅引擎更新状态 |
| C12 | sjgl02PermissionLogs.logging | `false` | `false` | **`false`** | 日志表本身不需被审计 |
| C13 | 主键动态发现 | 未提及 | 未提及 | **D8：动态发现目标表主键，不写死 `id`** | NocoBase 支持多种主键类型和非 `id` 命名的复合/单一主键 |

---

## 附录 B：i18n key 清单

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
  "进行中":"进行中","排队中":"排队中","失败":"失败","已取消":"已取消",
  "查看":"查看","取消":"取消","下载":"下载","关闭":"关闭","取消任务":"取消任务","重新导出":"重新导出",
  "任务详情":"任务详情","任务类型":"任务类型","目标数据表":"目标数据表","进度":"进度","创建人":"创建人",
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
  "显示值":"显示值","主键值":"主键值({key})","显示值+主键值":"显示值+主键值",
  "严格模式单次导入上限50万行":"严格模式单次导入上限50万行，当前{count}行，请分批导入",
  "更新模式必须选择唯一值字段":"更新/新增+更新模式必须至少选择1个唯一值字段",
  "唯一值字段存在空值":"唯一值字段存在空值，整批回滚",
  "导入行数超限":"导入行数超限",
  "无主键集合仅支持新增":"无主键集合仅支持新增(insert)模式",
  "主键字段未映射":"主键字段 \"{name}\" 未在Excel中映射且不可自动生成",
  "主键":"主键",
  "复合主键":"复合主键"
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
  "进行中":"Processing","排队中":"Pending","失败":"Failed","已取消":"Canceled",
  "查看":"View","取消":"Cancel","下载":"Download","关闭":"Close","取消任务":"Cancel Task","重新导出":"Re-export",
  "任务详情":"Task Details","任务类型":"Type","目标数据表":"Table","进度":"Progress","创建人":"Creator",
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
  "显示值":"Display Value","主键值":"Primary Key({key})","显示值+主键值":"Display+Key",
  "严格模式单次导入上限50万行":"Strict mode import limit is 500,000 rows; current {count} rows. Please import in batches.",
  "更新模式必须选择唯一值字段":"Update/Upsert mode requires at least one unique field",
  "唯一值字段存在空值":"Unique field contains empty value; entire batch rolled back",
  "导入行数超限":"Import row limit exceeded",
  "无主键集合仅支持新增":"Collections without a primary key only support insert mode",
  "主键字段未映射":"Primary key field \"{name}\" is not mapped in Excel and cannot be auto-generated",
  "主键":"Primary Key",
  "复合主键":"Composite Key"
}
```

---

*文档结束。本文件为唯一权威开发依据。*
