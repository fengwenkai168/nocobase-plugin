# @my-project/plugin-shuiyin1

> 当前版本：**v0.2.8**

NocoBase 全局水印插件，在页面最上层覆盖半透明水印，显示当前登录用户名称，支持通过插件设置页动态配置水印内容、透明度、字号、排列密度、是否显示当前年月日时间、开启/关闭水印，并具备防删除与定时刷新能力。

---

## 0. 版本兼容性

- **兼容范围**：NocoBase `2.x`（peerDependencies 使用 `2.x` 格式）
- 插件同时包含 `client-v1` 与 `client-v2` 两套实现，可适配不同版本的 NocoBase UI 运行时。

---

## 1. 功能特性

| 特性 | 说明 |
|------|------|
| 全局水印 | 页面固定定位覆盖，不影响正常点击操作 |
| 显示当前用户 | 默认读取当前登录用户的昵称/用户名/邮箱 |
| 自定义文字 | 可在设置页覆盖默认用户名称 |
| 启用水印开关 | 总开关：关闭时移除水印 DOM，配置保留不丢失 |
| 透明度调节 | 范围 0.01 ~ 1，默认 0.15 |
| 字号调节 | 范围 8 ~ 72，默认 10px |
| 排列密度 | 1 ~ 5 档，默认 5；1 最稀疏，5 最密集 |
| 显示当前年月日时间 | 开关控制，开启后水印文字追加实时日期时间（每分钟刷新） |
| 防删除 | MutationObserver + 定时轮询检测水印 DOM，被移除后自动重建 |
| 实时生效 | 设置页保存后通过自定义事件立即通知水印组件重绘 |
| 双端兼容 | 同时提供 client-v1 与 client-v2 两套实现 |

---

## 2. 安装与启用

### 2.1 构建插件

在 NocoBase 应用根目录执行：

```bash
yarn build
```

构建完成后会在本插件目录下生成 `dist/`。

### 2.2 启用插件

```bash
nb pm enable @my-project/plugin-shuiyin1
```

或在后台 插件管理 → 找到 `@my-project/plugin-shuiyin1` → 启用。刷新页面即可看到水印。

### 2.3 生产上传升级流程

```bash
cd my-nocobase-app/packages/plugins/@my-project
tar -czf plugin-shuiyin1-0.2.8.tar.gz plugin-shuiyin1/
```

然后到后台 → 插件管理 → 上传该 `.tar.gz` 文件。

上传成功后**必须进行系统级重启才能生效**，仅点击后台网页的"重启"按钮无效：

- **Docker 部署**：`docker restart <容器名>` 或重启整个容器服务
- **PM2 进程管理**：`pm2 restart all`
- **源码部署**：`yarn nocobase pm2-restart` 或重新运行启动脚本

重启后插件会通过 `syncVersion()` 自动将 `applicationPlugins` 表中的版本号与 `package.json` 保持一致。

---

## 3. 配置说明

启用插件后，进入后台 **设置 → 水印设置**（Watermark Settings）页面：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 启用水印 | 开启 | 总开关：关闭后水印 DOM 移除，配置保留不丢失 |
| 水印文字 | 空字符串 | 留空则使用当前登录用户昵称 |
| 透明度 | 0.15 | 越小越透明，建议 0.1 ~ 0.3 |
| 字号 | 10 | 单位 px |
| 排列密度 | 5 | 1 ~ 5，数字越大水印越密集 |
| 显示当前年月日时间 | 开启 | 开启后水印变成 `文字 2026-06-30 16:55` 并每分钟刷新 |

修改后点击 **保存**，页面水印会立即生效，刷新页面后仍然保持最新设置。

---

## 4. 实现原理

### 4.1 服务端实现（`src/server/plugin.ts`）

插件服务端继承 `Plugin` 基类，在生命周期钩子中完成初始化：

**`load()` 阶段：**
- **ACL 授权**：调用 `this.app.acl.allow('shuiyin1_settings', '*', 'loggedIn')` 允许所有已登录用户读写水印配置，无需管理员权限
- **版本同步**：调用 `syncVersion()` 从 `_plugins` 表查询本插件记录，对比 `package.json` 中的版本号，不一致时自动更新数据库中的版本字段，保持与打包版本一致
- **README 路由**：注册 `/api/plugins/@my-project/plugin-shuiyin1/readme` GET 端点，读取本地 `README.md` 文件并渲染为 HTML 页面，方便在浏览器中查看插件文档

**`install()` 阶段：**
- 检查 `shuiyin1_settings` 集合是否有记录
- 若无记录，创建一条默认配置（空文字、透明度 0.15、字号 10、显示时间、密度 5、启用水印）

**`upgrade()` 阶段：**
- NocoBase 在生产环境上传新版本后会自动调用此方法
- 调用 `syncVersion()` 同步版本号
- 调用 `migrateEnabledField()` 为已有记录补充 `enabled` 字段默认值

### 4.2 客户端实现（`src/client/plugin.tsx` / `src/client-v2/plugin.tsx`）

**水印渲染流程：**

1. **用户信息获取**：调用 `auth:check` API 获取当前登录用户信息，提取 `nickname` / `username` / `email` 作为水印默认文字
2. **配置加载**：调用 `shuiyin1_settings:list` API 获取数据库中的水印配置，合并默认值
3. **启用水印判断**：若 `enabled` 为 `false`，跳过水印渲染并移除已有水印 DOM
4. **DOM 渲染**：使用 Canvas 绘制倾斜文字图片，作为 `div#shuiyin1-watermark-overlay` 的 `background-image` 平铺覆盖全视口
   - Canvas 单元大小由密度决定（1~5 对应 400x280 ~ 140x90）
   - 透明度通过 `ctx.globalAlpha` 控制
   - 文字以 -30° 旋转绘制
5. **时间刷新**：如果开启显示时间，启动每分钟定时器重绘 Canvas，更新时间字符串
6. **防删除机制**：
   - `MutationObserver` 监听 `document.body` 的子节点变化
   - 每 2 秒轮询检查水印 DOM 是否存在
   - 发现被移除立即重建
7. **周期性刷新**：每 30 秒重新从 API 拉取配置并重绘水印；同时重新获取当前用户信息，确保账号切换后水印用户名自动更新

**资源清理：**
- 插件禁用时（`afterDisable()`）自动清理所有定时器、断开 MutationObserver、移除事件监听器、恢复 `history.pushState`、移除水印 DOM

**设置页交互：**

- 用户在设置页修改配置后，调用 `shuiyin1_settings:update` 或 `shuiyin1_settings:create` API 保存到数据库
- 保存成功后，通过 `window.dispatchEvent(new CustomEvent('shuiyin1:settings:changed', { detail: settings }))` 派发事件
- 水印插件监听该事件，直接使用事件携带的最新配置重绘，无需等待下次 API 请求

**认证页面跳过：**

- 在 `/signin`、`/signup`、`/forgot-password`、`/reset-password` 页面自动跳过水印初始化和 API 请求，通过路由监听在用户登录后自动初始化

---

## 5. 数据库使用逻辑

### 5.1 集合定义

使用 `shuiyin1_settings` 集合（通过 `@nocobase/database` 的 `defineCollection` 定义）：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `id` | autoIncrement | — | 主键 |
| `createdAt` | datetime | — | 创建时间（自动） |
| `updatedAt` | datetime | — | 更新时间（自动） |
| `text` | string | `""` | 自定义水印文字，为空则使用用户名 |
| `opacity` | float | `0.15` | 透明度 0.01~1 |
| `fontSize` | integer | `10` | 字号 8~72 |
| `showTime` | boolean | `true` | 是否显示当前时间 |
| `density` | integer | `5` | 排列密度 1~5 |
| `enabled` | boolean | `true` | 是否启用水印 |

### 5.2 CRUD 操作

所有 CRUD 通过 NocoBase 自动生成的 REST API 完成：

| 操作 | API | 说明 |
|------|-----|------|
| 查询 | `POST /api/shuiyin1_settings:list` | 客户端加载配置时调用 |
| 创建 | `POST /api/shuiyin1_settings:create` | 首次保存配置时调用 |
| 更新 | `POST /api/shuiyin1_settings:update?filterByTk={id}` | 更新已有配置 |

- 权限策略：`loggedIn`（所有已登录用户可读写）
- 安装时自动创建一条默认记录
- 升级时自动迁移 `enabled` 字段

### 5.3 插件生命周期钩子

```
afterAdd() → beforeLoad() → load() → upgrade()（版本变更时）→ install()（仅首次）→ afterEnable()
```

- `load()`：ACL 授权 + 版本同步 + 注册 README 路由
- `upgrade()`：版本升级时同步版本号 + 执行数据迁移（如新增字段补充默认值）
- `install()`：创建默认配置记录
- `afterEnable()` / `afterDisable()` / `remove()`：资源清理等

> **注意**：生产环境上传新版本后，NocoBase 调用 `upgrade()` 完成升级。如果 `upgrade()` 未实现，版本号可能不同步，导致显示旧版本号。

---

## 6. 项目结构

```
packages/plugins/@my-project/plugin-shuiyin1/
├── src/
│   ├── client/                     # client-v1 实现
│   │   ├── index.tsx               # 导出插件类
│   │   ├── plugin.tsx              # 插件主类：水印渲染、配置读取、事件监听、资源清理
│   │   └── pages/
│   │       └── ShuiyinSettings.tsx  # 设置页组件（v1、v2 共用）
│   ├── client-v2/                  # client-v2 实现
│   │   ├── index.tsx
│   │   └── plugin.tsx              # 插件主类（与 v1 逻辑一致）
│   ├── common/                     # v1/v2 共享模块
│   │   └── watermark-core.ts       # 水印核心逻辑：渲染、密度映射、认证页面检测
│   ├── server/
│   │   ├── index.ts                # 导出服务端插件
│   │   ├── plugin.ts               # 服务端插件：ACL、版本同步、README 路由、安装默认数据、升级迁移
│   │   └── collections/
│   │       └── shuiyin1_settings.ts # 集合定义
│   ├── locale/
│   │   ├── zh-CN.json              # 中文翻译
│   │   └── en-US.json              # 英文翻译
│   └── index.ts                    # 插件入口（导出 server + client）
├── dist/                           # 构建产物（client + server + locale）
├── client.js                       # shim：指向 dist/client/index.js
├── client-v2.js                    # shim：指向 dist/client-v2/index.js
├── server.js                       # shim：指向 dist/server/index.js
├── package.json                    # 插件元数据 + peerDependencies
├── README.md                       # 插件说明文档
├── CHANGELOG.md                    # 更新日志
└── 产品文档.md                     # 中文用户使用手册
```

---

## 7. 开发与调试

### 7.1 常用命令

```bash
# 构建本插件
cd my-nocobase-app && yarn build

# 启动开发服务器
nb app start

# 停止服务器
nb app stop

# 重启服务器
nb app restart

# 查看日志
nb app logs
```

### 7.2 调试技巧

生产环境默认关闭调试日志。如需开启，修改 `src/common/watermark-core.ts` 中 `DEBUG` 为 `true`，重新构建后浏览器控制台会输出 `[shuiyin1]` 前缀日志：

- `plugin load started`：插件开始加载
- `fetching settings...`：正在请求配置
- `raw settings response`：原始 API 响应
- `parsed settings`：解析后的配置
- `applying initial watermark`：正在应用初始水印
- `watermark refreshed, reason: ...`：水印重绘原因及当前配置

如果刷新后配置未生效，请检查日志中 `parsed settings` 是否与数据库一致。

---

## 8. 常见问题

### 8.1 保存后水印没有变化

1. 确认已点击 **保存** 且提示保存成功
2. 查看控制台是否有 `[shuiyin1] watermark refreshed, reason: settings changed`
3. 检查事件详情中的配置是否为最新值

### 8.2 刷新页面后恢复默认水印

1. 查看控制台 `raw settings response` 和 `parsed settings`
2. 若 `parsed settings` 为空，检查 `shuiyin1_settings` 表是否有记录
3. 若响应结构异常，确认插件已构建到最新代码

### 8.3 水印文字显示的是用户名而不是自定义文字

水印文字留空时会回退到当前登录用户名，如需自定义请填写内容。

### 8.4 水印影响页面操作

水印层设置了 `pointer-events: none`，不会拦截鼠标事件。

### 8.5 如何临时关闭水印

进入 **设置 → 水印设置**，将「启用水印」开关关闭后保存即可。配置保留不丢失，重新打开开关后恢复。

---

## 9. API 参考

### 9.1 数据集合

- **集合名**：`shuiyin1_settings`
- **权限**：所有已登录用户可读写（`loggedIn`）

### 9.2 服务端端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `shuiyin1_settings:list` | POST | 查询配置记录 |
| `shuiyin1_settings:create` | POST | 创建配置记录 |
| `shuiyin1_settings:update` | POST | 更新配置记录，需传 `filterByTk` |
| `/api/plugins/@my-project/plugin-shuiyin1/readme` | GET | 查看插件说明文档（HTML） |

### 9.3 客户端事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `shuiyin1:settings:changed` | 设置页 → 插件 | 保存成功后通知水印组件重绘，`detail` 为最新配置 |

---

## 10. 注意事项

1. 修改集合字段后，需要重新构建插件并同步数据库结构。
2. 插件同时维护 `client` 与 `client-v2` 两套代码，公共逻辑已抽取到 `src/common/watermark-core.ts`，修改时请注意同步。
3. 生产环境调试日志默认关闭，如需开启修改 `src/common/watermark-core.ts` 中的 `DEBUG` 常量。
4. 水印仅在前端渲染，无法阻止高级用户通过开发者工具禁用，建议配合权限与审计使用。

---

## 11. 更新日志

### v0.2.8（2026-06-30）

- **修复**：注销账号后水印不消失（需手动刷新），`refreshWatermark()` 和 `renderWatermark()` 新增认证页面检测，30s 内自动移除水印 DOM

### v0.2.7（2026-06-30）

- **修复**：账号退出→切换登录后，水印仍显示旧用户名（需手动刷新才更新）
- **修复**：周期性刷新（30s）现在会重新调用 `auth:check` 更新当前用户名，确保退出再登录后水印用户信息自动刷新
- **修复**：`yarn nocobase upgrade` 升级流程可正常执行，`migrateEnabledField()` 补充旧记录 `enabled` 字段

### v0.2.6（2026-06-30）

- **新增**：设置页「启用水印」总开关，关闭后水印 DOM 移除，配置保留不丢失
- **新增**：`src/common/watermark-core.ts` 公共模块，消除 v1/v2 代码重复
- **新增**：`upgrade()` 中 `migrateEnabledField()` 为已有记录补充 `enabled` 默认值
- **修复**：默认值统一（`fontSize=10`、`density=5`、`showTime=true`），与 `createDefaultSettings()` 保持一致
- **修复**：`src/index.ts` 同时导出 server 和 client 两端
- **修复**：客户端新增 `afterDisable()` → `cleanup()` 资源清理，含定时器、MutationObserver、事件监听器、history.pushState 恢复
- **优化**：`upgrade()` 调用 `syncVersion()` 确保升级后版本号同步
- **优化**：调试日志用 `DEBUG` 常量包裹（默认关闭）
- **文档**：新增 `CHANGELOG.md`、`产品文档.md`，更新 README 项目结构和配置说明

### v0.2.5（2026-06-16）

- **修复**：登录页面刷新后登录，水印不出现、设置菜单入口消失的问题
- **修复**：设置菜单注册移到 `isAuthPage()` 检查前，始终注册菜单
- **修复**：认证页面通过路由监听自动初始化水印

### v0.2.4

- **修复**：版本同步逻辑确认正常工作

### v0.2.3

- **新增**：重建 `src/` 源码目录
- **新增**：`nocobase` 元数据字段、`upgrade()` 生命周期方法
- **优化**：重构版本同步逻辑为 `syncVersion()`

### v0.2.2

- **变更**：peerDependencies 改为 `>=2.1.9`，新增 `keywords` 字段

### v0.2.0

- **修复**：认证页面不显示水印、API 报错

### v0.1.0

- 初始版本：全局水印渲染、设置页、防删除、双端兼容
