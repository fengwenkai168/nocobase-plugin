# @my-project/plugin-shuiyin1

> 版本：**v0.2.9** | NocoBase 2.x | 全局水印插件

为 NocoBase 后台管理系统提供全局页面水印覆盖，在页面最上层绘制半透明倾斜文字水印（Canvas 渲染），自动显示当前登录用户身份标识，具备防删除、自动重建、配置实时生效、定时刷新等完整能力。同时提供 client-v1 和 client-v2 双端实现，适配不同版本的 NocoBase UI 运行时。

---

## 目录

1. [功能特性](#1-功能特性)
2. [安装与启用](#2-安装与启用)
3. [配置说明](#3-配置说明)
4. [实现原理](#4-实现原理)
5. [数据模型](#5-数据模型)
6. [项目结构](#6-项目结构)
7. [API 参考](#7-api-参考)
8. [开发与调试](#8-开发与调试)
9. [常见问题](#9-常见问题)
10. [安全建议](#10-安全建议)
11. [更新日志](#11-更新日志)

---

## 1. 功能特性

| 特性 | 说明 |
|------|------|
| 全局水印覆盖 | `position: fixed` 固定定位覆盖全视口，`z-index: 999999` 最高层级，`pointer-events: none` 不影响操作 |
| 用户身份标识 | 自动读取当前登录用户昵称/用户名/邮箱，优先使用昵称（nickname > username > email） |
| 自定义水印文字 | 配置页可填入任意文字，覆盖默认用户名显示 |
| 启用水印总开关 | 关闭后水印 DOM 立即移除，配置保留不丢失，重新打开即恢复 |
| 透明度调节 | 范围 0.01 ~ 1，通过 Canvas `globalAlpha` 控制，默认 0.15 |
| 字号调节 | 范围 8 ~ 72 px，默认 10px |
| 排列密度 | 1 ~ 5 档，1 最稀疏（单元格 400×280），5 最密集（单元格 140×90），默认 5 |
| 显示当前日期时间 | 开启后水印文字追加实时时间（格式 `yyyy-MM-dd HH:mm`），每分钟重绘刷新 |
| 防删除机制 | MutationObserver 监听 body 子节点变化 + 2 秒轮询检测，水印 DOM 被移除后自动重建 |
| 配置实时生效 | 设置页保存后通过 `CustomEvent('shuiyin1:settings:changed')` 即时刻通知水印组件重绘，无需刷新页面 |
| 周期性刷新 | 每 30 秒重新从 API 拉取配置和当前用户信息，自动更新水印用户标识 |
| 认证页面跳过 | 登录页（/signin）、注册页（/signup）、忘记密码（/forgot-password）、重置密码（/reset-password）自动跳过水印渲染 |
| 双端兼容 | 分别实现 client-v1（`@nocobase/client`）和 client-v2（`@nocobase/client-v2`），共享设置页和核心逻辑 |
| 版本自动同步 | `load()` 阶段自动将 `package.json` 版本号同步到数据库 `_plugins` 表 |
| 升级数据迁移 | `upgrade()` 阶段自动为旧记录补充 `enabled` 字段默认值 |

---

## 2. 安装与启用

### 2.1 构建插件

在 NocoBase 应用根目录执行：

```bash
nb source build
```

构建完成后插件目录下生成 `dist/` 编译产物（含 `dist/server/`、`dist/client/`、`dist/client-v2/`、`dist/common/`、`dist/locale/`）。

### 2.2 启用插件

```bash
nb plugin enable @my-project/plugin-shuiyin1
```

或在后台 **插件管理** 中找到 `@my-project/plugin-shuiyin1`，点击启用。刷新页面后即可看到水印。

### 2.3 生产环境上传安装

```bash
cd packages/plugins/@my-project
tar -czf /workspace/nocobase1/plugin-shuiyin1-0.2.9.tar.gz plugin-shuiyin1/
```

在后台 **插件管理 → 上传插件** 选择生成的 `.tar.gz` 文件上传。

**上传后必须重启整个 NocoBase 服务**（仅点后台"重启"按钮无效）：

- **Docker 部署**：`docker restart <容器名>`
- **PM2 进程管理**：`pm2 restart all`
- **源码部署**：`nb app restart` 或 `pm2 restart all`

重启后插件会通过 `syncVersion()` 自动同步版本号到数据库。

---

## 3. 配置说明

启用插件后，进入后台 **设置 → 水印设置**（Watermark Settings）页面：

| 配置项 | 字段名 | 类型 | 默认值 | 范围 | 说明 |
|--------|--------|------|--------|------|------|
| 启用水印 | `enabled` | boolean | `true` | 开关 | 总开关：关闭后水印 DOM 移除，配置保留，重新打开后恢复 |
| 水印文字 | `text` | string | `""` | 任意文本 | 留空则自动使用当前登录用户昵称/用户名/邮箱 |
| 透明度 | `opacity` | float | `0.15` | 0.01 ~ 1 | 越小越透明，建议 0.10 ~ 0.30 |
| 字号 | `fontSize` | integer | `10` | 8 ~ 72 | 单位 px，水印文字大小 |
| 排列密度 | `density` | integer | `5` | 1 ~ 5 | 1 最稀疏（400×280），5 最密集（140×90） |
| 显示当前年月日时间 | `showTime` | boolean | `true` | 开关 | 开启后水印文字追加实时日期时间（yyyy-MM-dd HH:mm），每分钟刷新 |

修改后点击 **保存**，页面水印立即生效（通过自定义事件通知），无需手动刷新浏览器。

---

## 4. 实现原理

### 4.1 整体架构

```
src/index.ts (入口)
  └── src/server/index.ts → src/server/plugin.ts          # 服务端
  └── src/client/index.tsx → src/client/plugin.tsx         # 客户端 v1
  └── src/client-v2/index.tsx → src/client-v2/plugin.tsx   # 客户端 v2
  └── src/common/watermark-core.ts                         # v1/v2 共享模块
  └── src/client/pages/ShuiyinSettings.tsx                 # 设置页（v1/v2 共用）
```

### 4.2 服务端实现细节

**文件**：`src/server/plugin.ts`（129 行）

| 生命周期 | 操作 |
|----------|------|
| `load()` | ① ACL 授权：`this.app.acl.allow('shuiyin1_settings', '*', 'loggedIn')` — 所有已登录用户可读写水印配置<br>② `syncVersion()`：从 `_plugins` 表查询本插件记录，与 `package.json` 版本号对比，不一致时自动更新<br>③ 注册 README 路由：`GET /api/plugins/@my-project/plugin-shuiyin1/readme` — 读取本地 `README.md` 渲染为 HTML |
| `install()` | 检查 `shuiyin1_settings` 集合，无记录则创建一条默认配置（text='', opacity=0.15, fontSize=10, showTime=true, density=5, enabled=true） |
| `upgrade()` | ① `syncVersion()`：同步版本号<br>② `migrateEnabledField()`：遍历已有记录，补充缺失的 `enabled` 字段（默认 `true`） |
| `afterEnable()` | 空（保留扩展） |
| `afterDisable()` | 空（保留扩展） |
| `remove()` | 空（保留扩展） |

### 4.3 `syncVersion()` 实现

```
1. 从 this.options.packageName 获取包名
2. readPackageJson() 尝试两个路径读取 package.json：
   - __dirname/../../package.json （默认）
   - __dirname/../../../package.json （备选）
3. 从 this.app.pm.repository 查询 _plugins 表中对应记录
4. 比较 dbVersion 与 pkg.version，不一致时更新数据库
```

### 4.4 客户端实现细节

**文件**：`src/client/plugin.tsx` 和 `src/client-v2/plugin.tsx`（各 254 行，逻辑一致）

#### 4.4.1 `load()` 阶段

```
1. 始终注册设置菜单（pluginSettingsManager.add），确保菜单不丢失
2. 检测是否为认证页面（isAuthPage()）：
   - 是：不立即初始化水印，而是通过以下三种机制检测路由变化：
     a. 劫持 history.pushState（SPA 路由切换时触发）
     b. 监听 popstate 事件（浏览器前进/后退触发）
     c. requestAnimationFrame 兜底检测（持续轮询）
     检测到离开认证页面时自动调用 startup() 初始化
   - 否：直接调用 startup() 初始化水印
```

#### 4.4.2 `startup()` 阶段

```
1. 调用 auth:check API 获取当前用户（nickname/username/email）
2. 调用 shuiyin1_settings:list API 获取水印配置
3. initWatermark()：
   - 检查 document.body 是否就绪，未就绪则等待 DOMContentLoaded
   - 若 enabled=true，调用 renderWatermark() 渲染水印
   - 启动 checkTimer（每 2 秒检查水印 DOM 是否存在）
   - 若 showTime=true，启动 timeTimer（每分钟重绘更新时间）
   - 启动 MutationObserver（监听 body 子节点变化，DOM 被移除时重建）
4. 监听 shuiyin1:settings:changed 自定义事件（设置页保存后触发）
5. 启动 refreshTimer（每 30 秒重新拉取配置和用户信息并重绘）
```

#### 4.4.3 `afterDisable()` 阶段

完整清理所有资源：
- 清除 checkTimer（2s 轮询）
- 清除 timeTimer（每分钟时间刷新）
- 清除 refreshTimer（30s 周期性刷新）
- 断开 MutationObserver
- 移除 `shuiyin1:settings:changed` 事件监听
- 移除 popstate 事件监听
- 恢复原始 `history.pushState`
- 移除水印 DOM 元素

#### 4.4.4 `refreshWatermark()` 钩子

```
1. 先检测是否为认证页面：
   - 是：清除 timeTimer，移除水印 DOM，直接返回
2. 重新调用 fetchUser() 更新当前用户名（解决退出再登录后水印显示旧用户名的问题）
3. 调用 fetchSettings() 重新获取配置
4. 调用 renderWatermark() 重绘
```

### 4.5 水印渲染核心（`src/common/watermark-core.ts`）

**文件**：105 行，被 v1 和 v2 客户端共同引用

#### 4.5.1 密度映射表

| 密度值 | 单元格宽度（px） | 单元格高度（px） |
|--------|-----------------|-----------------|
| 1 | 400 | 280 |
| 2 | 320 | 220 |
| 3 | 240 | 160 |
| 4 | 180 | 120 |
| 5 | 140 | 90 |

#### 4.5.2 `renderWatermark(settings, username)` 执行流程

```
1. 检测 isAuthPage()：是则移除水印 DOM 并返回
2. 检测 settings.enabled：false 则移除水印 DOM 并返回
3. 创建或获取 #shuiyin1-watermark-overlay div：
   - position: fixed, top: 0, left: 0, width: 100vw, height: 100vh
   - pointer-events: none（不拦截鼠标事件）
   - z-index: 999999（最高层级）
   - background-repeat: repeat
4. 确定水印文字：settings.text 不为空则用 settings.text，否则用 username
5. 若 showTime=true，追加当前年月日时间（yyyy-MM-dd HH:mm）
6. 创建 Canvas（尺寸由 densityMap 决定）：
   - ctx.globalAlpha = settings.opacity
   - ctx.font = settings.fontSize + 'px sans-serif'
   - ctx.fillStyle = '#000000'
   - ctx.textAlign = 'center'
   - ctx.textBaseline = 'middle'
   - ctx.translate + ctx.rotate(-30°) 倾斜绘制
7. canvas.toDataURL('image/png') 设为 div 的 background-image
```

#### 4.5.3 认证页面列表

```typescript
['/signin', '/signup', '/forgot-password', '/reset-password']
```

使用 `window.location.pathname` 做前缀匹配（支持子路径如 `/signin/xxx`）。

---

## 5. 数据模型

### 5.1 集合定义

**集合名**：`shuiyin1_settings`（通过 `@nocobase/database` 的 `defineCollection` 定义）

**文件**：`src/server/collections/shuiyin1_settings.ts`

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `id` | autoIncrement（自动） | — | 主键 |
| `createdAt` | datetime（自动） | — | 记录创建时间 |
| `updatedAt` | datetime（自动） | — | 记录最后更新时间 |
| `text` | string | `""` | 自定义水印文字，空字符串时使用当前用户名 |
| `opacity` | float | `0.15` | 透明度，有效范围 0.01 ~ 1 |
| `fontSize` | integer | `10` | 字号，单位 px，有效范围 8 ~ 72 |
| `showTime` | boolean | `true` | 是否在水印中显示当前日期时间 |
| `density` | integer | `5` | 排列密度，1 ~ 5 档 |
| `enabled` | boolean | `true` | 水印总开关 |

### 5.2 CRUD 操作

所有数据操作通过 NocoBase 自动生成的 RESTful API 完成：

| 操作 | API 端点 | HTTP 方法 | 说明 |
|------|----------|-----------|------|
| 查询配置 | `shuiyin1_settings:list` | POST | 客户端加载配置时调用，返回数组，取第一项 |
| 创建配置 | `shuiyin1_settings:create` | POST | 数据库中无配置记录时首次保存调用 |
| 更新配置 | `shuiyin1_settings:update?filterByTk={id}` | POST | 已有配置记录时保存调用 |

### 5.3 权限策略

- **资源**：`shuiyin1_settings`
- **操作**：`*`（全部 CRUD）
- **角色**：`loggedIn`（所有已登录用户）
- **说明**：不限制管理员或特定角色，任何已登录用户都可以读写水印配置

---

## 6. 项目结构

```
packages/plugins/@my-project/plugin-shuiyin1/
├── src/                                  # 源码目录
│   ├── index.ts                          # 插件入口，导出 server 模块
│   ├── server/                           # 服务端实现
│   │   ├── index.ts                      # 导出 PluginShuiyin1Server
│   │   ├── plugin.ts                     # 服务端插件主类：
│   │   │                                 #   load() — ACL 授权 + 版本同步 + README 路由
│   │   │                                 #   install() — 创建默认配置
│   │   │                                 #   upgrade() — 版本同步 + enabled 字段迁移
│   │   │                                 #   syncVersion() — 版本号同步
│   │   │                                 #   migrateEnabledField() — 旧记录 enabled 补充
│   │   └── collections/                  # 数据模型定义
│   │       └── shuiyin1_settings.ts      # 集合定义：6 个自定义字段
│   ├── client/                           # 客户端 v1 实现
│   │   ├── index.tsx                     # 导出 PluginShuiyin1Client
│   │   ├── plugin.tsx                    # v1 插件主类（254 行）：
│   │   │                                 #   load() — 注册设置菜单 + 认证页面检测 + 初始化
│   │   │                                 #   startup() — 获取用户 + 加载配置 + 渲染水印
│   │   │                                 #   cleanup() — 清理所有定时器/观察器/事件/资源
│   │   │                                 #   refreshWatermark() — 重新拉取配置并刷新
│   │   │                                 #   applyWatermark() — 按 enabled 状态渲染或移除
│   │   └── pages/
│   │       └── ShuiyinSettings.tsx       # 设置页组件（v1/v2 共用）
│   ├── client-v2/                        # 客户端 v2 实现
│   │   ├── index.tsx                     # 导出 PluginShuiyin1ClientV2
│   │   └── plugin.tsx                    # v2 插件主类（254 行，逻辑与 v1 一致）
│   ├── common/                           # v1/v2 共享公共模块
│   │   └── watermark-core.ts            # 水印核心逻辑（105 行）：
│   │                                     #   renderWatermark() — Canvas 水印渲染
│   │                                     #   isAuthPage() — 认证页面判断
│   │                                     #   densityMap — 密度→单元格尺寸映射
│   │                                     #   WATERMARK_ID / defaultSettings / authPages — 常量
│   └── locale/                           # 国际化翻译
│       ├── zh-CN.json                    # 中文翻译（18 键）
│       └── en-US.json                    # 英文翻译（18 键）
├── dist/                                 # 构建产物目录
│   ├── server/                           # 服务端编译产物
│   ├── client/                           # v1 客户端编译产物
│   ├── client-v2/                        # v2 客户端编译产物
│   ├── common/                           # 公共模块编译产物
│   ├── locale/                           # 翻译文件副本
│   └── externalVersion.js               # 外部依赖版本声明
├── server.js                             # shim：module.exports = require('./dist/server/index.js')
├── client.js                             # shim：module.exports = require('./dist/client/index.js')
├── client-v2.js                          # shim：module.exports = require('./dist/client-v2/index.js')
├── package.json                          # 插件元数据 + 依赖声明
├── README.md                             # 本文件
├── CHANGELOG.md                          # 版本更新日志
└── 产品文档.md                           # 面向最终用户的产品手册
```

### 文件数量统计

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `src/server/` | 3 | plugin + index + collection |
| `src/client/` | 3 | plugin + index + settings page |
| `src/client-v2/` | 2 | plugin + index |
| `src/common/` | 1 | watermark-core |
| `src/locale/` | 2 | zh-CN + en-US |
| shim / config | 4 | server.js, client.js, client-v2.js, package.json |
| 文档 | 3 | README.md, CHANGELOG.md, 产品文档.md |
| **合计** | **18** | |

---

## 7. API 参考

### 7.1 数据资源端点

| 端点 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `shuiyin1_settings:list` | POST | loggedIn | 查询水印配置记录，返回数组 |
| `shuiyin1_settings:create` | POST | loggedIn | 创建水印配置记录 |
| `shuiyin1_settings:update` | POST | loggedIn | 更新水印配置记录，需传参数 `filterByTk={id}` |

### 7.2 自定义路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/plugins/@my-project/plugin-shuiyin1/readme` | GET | 读取本插件 `README.md` 渲染为 HTML 页面，可在浏览器中直接查看文档 |

### 7.3 认证端点（内部使用）

| 端点 | 说明 |
|------|------|
| `auth:check` | 获取当前登录用户信息（nickname/username/email），客户端启动和周期性刷新时调用 |

### 7.4 客户端自定义事件

| 事件名 | 触发方 | 监听方 | 说明 |
|--------|--------|--------|------|
| `shuiyin1:settings:changed` | 设置页（保存后） | 客户端插件 | `detail` 包含最新配置对象，水印组件直接使用该配置重绘，无需等待 API |

### 7.5 水印 DOM 标识

| 常量 | 值 | 说明 |
|------|-----|------|
| `WATERMARK_ID` | `shuiyin1-watermark-overlay` | 水印覆盖层 div 的 DOM id |

---

## 8. 开发与调试

### 8.1 构建命令

```bash
# 在 NocoBase 应用根目录执行

# 全量构建所有插件（含本插件）
nb source build

# 仅构建本插件
nb source build @my-project/plugin-shuiyin1

# 跳过类型声明生成（加快构建速度）
nb source build @my-project/plugin-shuiyin1 --no-dts
```

### 8.2 服务管理

```bash
# 启动开发服务器
nb source dev

# 查看开发日志
tail -f /workspace/nocobase1/logs/dev-server.log

# 重启开发服务器
sh /workspace/nocobase1/stop-dev.sh
sh /workspace/nocobase1/start-dev.sh
```

### 8.3 调试日志

生产环境默认关闭调试日志。需要开启时：

1. 修改 `src/common/watermark-core.ts:2` 将 `const DEBUG = false` 改为 `const DEBUG = true`
2. 重新构建：`nb source build`
3. 刷新浏览器，控制台会输出以 `[shuiyin1]` 为前缀的日志

**日志输出说明：**

| 日志内容 | 含义 |
|----------|------|
| `plugin load started` | 插件客户端 load 已触发 |
| `fetching settings...` | 正在向 API 请求水印配置 |
| `raw settings response:` | 原始 API 响应数据 |
| `parsed settings:` | 经过默认值合并后的最终配置 |
| `applying initial watermark with settings:` | 正在渲染初始水印 |
| `watermark refreshed, reason: ...` | 水印已重新绘制，标注触发原因 |
| `watermark disabled, reason:` | 水印因 enabled=false 被移除 |
| `user refreshed:` | 当前用户信息已更新 |
| `document.body not ready, waiting DOMContentLoaded` | 等待 DOM 就绪 |

**常见触发原因（reason）：**

| reason | 说明 |
|--------|------|
| `settings changed` | 设置页保存后触发的 `CustomEvent` |
| `periodic refresh` | 30 秒定时刷新 |

### 8.4 手动触发水印刷新

在浏览器控制台执行：

```javascript
// 无参数触发（重新拉取 API）
window.dispatchEvent(new CustomEvent('shuiyin1:settings:changed'));

// 带配置触发（直接使用给定配置渲染）
window.dispatchEvent(new CustomEvent('shuiyin1:settings:changed', {
  detail: { text: '测试文字', opacity: 0.2, fontSize: 14, showTime: false, density: 3, enabled: true }
}));
```

---

## 9. 常见问题

### 9.1 保存后水印没有变化

1. 确认已点击 **保存** 且提示"保存成功"
2. 打开浏览器控制台，查看是否有 `[shuiyin1] watermark refreshed, reason: settings changed` 日志
3. 若没有，检查是否有 JS 报错

### 9.2 刷新页面后水印恢复默认

1. 查看控制台 `[shuiyin1] parsed settings` 日志
2. 若 parsed settings 为空或为默认值，说明 API 返回异常
3. 检查 `shuiyin1_settings` 数据库表中是否有配置记录

### 9.3 水印文字显示用户名而非自定义文字

水印文字字段（text）留空时会回退到当前登录用户名。填入任意内容即可替换。

### 9.4 水印影响页面操作

水印层设置了 `pointer-events: none`，不会拦截任何鼠标/键盘事件。若有异常，检查是否有其他 CSS 覆盖此属性。

### 9.5 如何临时关闭水印

进入 **设置 → 水印设置**，将「启用水印」开关关闭后保存即可。水印立即消失，配置保留不丢失，重新打开开关后恢复。

### 9.6 注销登录后水印仍存在

插件的 `refreshWatermark()` 内置了 `isAuthPage()` 检测：进入 /signin 等认证页面时会自动移除水印 DOM。30 秒定时刷新周期内会自动触发检测。

### 9.7 退出登录→切换账号→水印仍显示旧用户名

插件的周期性刷新（30 秒）会重新调用 `auth:check` 获取当前用户信息，确保登录用户名自动更新。若需立即刷新，可手动刷新页面。

### 9.8 生产环境日志过多

在 `src/common/watermark-core.ts` 中将 `DEBUG` 常量设为 `false`，重新构建后所有 `[shuiyin1]` 调试日志将被关闭。

---

## 10. 安全建议

1. **前端渲染限制**：水印仅在前端浏览器中渲染，高级用户可通过浏览器开发者工具禁用或删除水印 DOM
2. **多层防护**：建议配合 NocoBase 内置的权限控制和审计日志使用，形成多层数据安全防护
3. **导出文件**：本插件不处理后端导出文件中的水印，敏感数据的 Excel/PDF 导出需额外处理
4. **防截图**：水印可提升截图溯源能力（包含用户名和时间），但不能完全阻止截图行为

---

## 11. 更新日志

### v0.2.9（2026-07-25）

- **修复**：`/v/`（v2 客户端）启动报错 `Script error for "@nocobase/client"` — `src/client-v2/plugin.tsx` 改从 `@nocobase/client-v2` 导入 `Plugin`，设置页注册迁移为 v2 写法（`addMenuItem` + `addPageTabItem` + `componentLoader`），新增 v2 版设置页 `src/client-v2/pages/ShuiyinSettings.tsx`
- **修复**：`isAuthPage()` 兼容 v2 路由前缀，登录页（`/v/signin`）不再渲染水印

### v0.2.8（2026-06-30）

- **修复**：注销账号后水印不消失 — `refreshWatermark()` 和 `renderWatermark()` 新增认证页面检测，进入登录等认证页面时自动移除水印 DOM

### v0.2.7（2026-06-30）

- **修复**：账号退出→切换登录后水印仍显示旧用户名 — 周期性刷新（30s）新增调用 `auth:check` 更新当前用户名
- **修复**：`yarn nocobase upgrade` 升级流程，`migrateEnabledField()` 可为旧记录补充 `enabled` 字段

### v0.2.6（2026-06-30）

- **新增**：「启用水印」总开关，关闭后水印 DOM 移除，配置保留不丢失
- **新增**：`src/common/watermark-core.ts` 公共模块，消除 v1/v2 代码重复
- **新增**：`upgrade()` 中 `migrateEnabledField()` 为已有记录补充 `enabled` 默认值
- **修复**：默认值统一（fontSize=10、density=5、showTime=true）
- **修复**：`src/index.ts` 同时导出 server 和 client
- **修复**：客户端 `afterDisable()` → `cleanup()` 完整资源清理
- **优化**：`upgrade()` 调用 `syncVersion()` 确保升级后版本号同步
- **优化**：调试日志用 `DEBUG` 常量包裹

### v0.2.5（2026-06-16）

- **修复**：登录页面刷新后登录，水印不出现、设置菜单入口消失
- **修复**：设置菜单注册移到 `isAuthPage()` 检查前，始终注册菜单
- **修复**：认证页面通过路由监听自动初始化水印（pushState 劫持 + popstate 监听 + requestAnimationFrame 兜底）

### v0.2.4

- **修复**：版本同步逻辑确认正常工作

### v0.2.3

- **新增**：重建 `src/` 源码目录
- **新增**：`nocobase` 元数据字段
- **新增**：`upgrade()` 生命周期方法
- **优化**：重构版本同步逻辑为 `syncVersion()`

### v0.2.2

- **变更**：peerDependencies 改为 `>=2.1.9`
- **新增**：`keywords` 字段

### v0.2.0

- **修复**：认证页面不显示水印、API 报错

### v0.1.0

- 初始版本：全局水印渲染、设置页、防删除、双端兼容
