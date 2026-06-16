# @my-project/plugin-shuiyin1

NocoBase 全局水印插件，在页面最上层覆盖半透明水印，显示当前登录用户名称，支持通过插件设置页动态配置水印内容、透明度、字号、排列密度及是否显示当前年月日时间，并具备防删除与定时刷新能力。

---

## 0. 版本兼容性

- **最低兼容 NocoBase 版本**：`2.1.5`
- **兼容范围**：`2.1.5 ~ 2.x`
- 插件同时包含 `client-v1` 与 `client-v2` 两套实现，可适配不同版本的 NocoBase UI 运行时。

> 当前插件基于 NocoBase 2.x 插件 API 开发，未使用 2.2.x 及以上版本的独占特性，因此可在 2.1.5 正式版中运行。建议在目标版本中实际测试后再部署到生产环境。

## 1. 功能特性

| 特性 | 说明 |
|------|------|
| 全局水印 | 页面固定定位覆盖，不影响正常点击操作 |
| 显示当前用户 | 默认读取当前登录用户的昵称/用户名/邮箱 |
| 自定义文字 | 可在设置页覆盖默认用户名称 |
| 透明度调节 | 范围 0.01 ~ 1，默认 0.15 |
| 字号调节 | 范围 8 ~ 72，默认 16px |
| 排列密度 | 1 ~ 5 档，默认 3；1 最稀疏，5 最密集 |
| 显示当前年月日时间 | 开关控制，开启后水印文字追加实时日期时间（每分钟刷新） |
| 防删除 | MutationObserver + 定时轮询检测水印 DOM，被移除后自动重建 |
| 实时生效 | 设置页保存后通过自定义事件立即通知水印组件重绘 |
| 双端兼容 | 同时提供 client-v1 与 client-v2 两套实现 |

---

## 2. 安装与启用

### 2.1 构建插件

在 NocoBase 源码根目录执行：

```bash
yarn build
```

构建完成后会在本插件目录下生成 `dist/`。

### 2.2 启用插件

进入 NocoBase 管理后台 → 插件管理，找到 `@my-project/plugin-shuiyin1` 并启用；或在 CLI 中执行：

```bash
nb pm enable @my-project/plugin-shuiyin1
```

启用后刷新页面即可看到水印。

---

## 3. 配置说明

启用插件后，进入后台 **设置 → 水印设置**（Watermark Settings）页面：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 水印文字 | 空字符串 | 留空则使用当前登录用户昵称 |
| 透明度 | 0.15 | 越小越透明，建议 0.1 ~ 0.3 |
| 字号 | 10 | 单位 px |
| 排列密度 | 5 | 1 ~ 5，数字越大水印越密集 |
| 显示当前年月日时间 | 开启 | 开启后水印变成 `文字 2026-06-16 16:55` 并每分钟刷新 |

修改后点击 **保存**，页面水印会立即生效，刷新页面后仍然保持最新设置。

---

## 4. 实现原理

### 4.1 水印渲染

插件通过 Canvas 生成倾斜的文字图片，作为固定 `div` 的 `background-image` 平铺覆盖整个视口：

- Canvas 单元大小由 **排列密度** 决定，密度越高单元越小、平铺越密集
- 文字默认是当前登录用户昵称，可被设置页文字覆盖
- 开启时间开关后，文字追加 `YYYY-MM-DD HH:mm`，并通过每分钟定时器重绘

### 4.2 防删除机制

- `MutationObserver` 监听 `document.body` 子节点变化
- 每 2 秒定时检查水印 DOM 是否存在
- 发现水印被移除后立即重建，使用当前最新配置

### 4.3 实时刷新机制

设置页保存成功后，派发自定义事件：

```js
window.dispatchEvent(new CustomEvent('shuiyin1:settings:changed', { detail: settings }));
```

水印组件监听该事件，直接应用事件携带的最新配置，无需等待下次 API 请求。

### 4.4 配置持久化

服务端使用 `shuiyin1_settings` 集合存储配置：

```ts
{
  text: string      // 水印文字
  opacity: float    // 透明度
  fontSize: integer // 字号
  showTime: boolean // 是否显示时间
  density: integer  // 排列密度 1-5
}
```

插件安装时会自动创建一条默认记录。

---

## 5. 项目结构

```
packages/plugins/@my-project/plugin-shuiyin1/
├── src/
│   ├── client/                    # client-v1 实现
│   │   ├── index.tsx
│   │   ├── plugin.tsx             # 插件主类：水印渲染、配置读取、事件监听
│   │   └── pages/
│   │       └── ShuiyinSettings.tsx # 设置页
│   ├── client-v2/                 # client-v2 实现
│   │   ├── index.tsx
│   │   ├── plugin.tsx
│   │   └── pages/
│   │       └── ShuiyinSettings.tsx
│   ├── server/
│   │   ├── index.ts
│   │   ├── plugin.ts              # 服务端插件：默认数据、ACL 授权
│   │   └── collections/
│   │       └── shuiyin1_settings.ts # 集合定义
│   ├── locale/
│   │   ├── zh-CN.json             # 中文翻译
│   │   └── en-US.json             # 英文翻译
│   └── index.ts                   # 插件入口
├── dist/                          # 构建产物
├── package.json
└── README.md
```

---

## 6. 开发与调试

### 6.1 常用命令

```bash
# 构建本插件
yarn build

# 启动开发服务器
nb app start

# 停止服务器
nb app stop

# 查看日志
nb app logs
```

### 6.2 调试技巧

浏览器控制台会输出 `[shuiyin1]` 前缀日志：

- `plugin load started`：插件开始加载
- `fetching settings...`：正在请求配置
- `raw settings response`：原始 API 响应
- `parsed settings`：解析后的配置
- `applying initial watermark`：正在应用初始水印
- `watermark refreshed, reason: ...`：水印重绘原因及当前配置

如果刷新后配置未生效，请检查日志中 `parsed settings` 是否与数据库一致。

---

## 7. 常见问题

### 7.1 保存后水印没有变化

1. 确认已点击 **保存** 且提示保存成功
2. 查看控制台是否有 `[shuiyin1] watermark refreshed, reason: settings changed`
3. 检查事件详情中的配置是否为最新值

### 7.2 刷新页面后恢复默认水印

1. 查看控制台 `raw settings response` 和 `parsed settings`
2. 若 `parsed settings` 为空，检查 `shuiyin1_settings` 表是否有记录
3. 若响应结构异常，确认插件已构建到最新代码

### 7.3 水印文字显示的是用户名而不是自定义文字

水印文字留空时会回退到当前登录用户名，如需自定义请填写内容。

### 7.4 水印影响页面操作

水印层设置了 `pointer-events: none`，不会拦截鼠标事件。

---

## 8. API 参考

### 8.1 数据集合

- **集合名**：`shuiyin1_settings`
- **字段**：`id`, `createdAt`, `updatedAt`, `text`, `opacity`, `fontSize`, `showTime`, `density`

### 8.2 服务端 Action

| Action | 说明 |
|--------|------|
| `shuiyin1_settings:list` | 查询配置记录 |
| `shuiyin1_settings:create` | 创建配置记录 |
| `shuiyin1_settings:update` | 更新配置记录，需传 `filterByTk` |

### 8.3 客户端事件

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `shuiyin1:settings:changed` | 设置页 → 插件 | 保存成功后通知水印组件重绘，`detail` 为最新配置 |

---

## 9. 注意事项

1. 修改集合字段后，需要重新构建插件并同步数据库结构（本插件已手动维护 `density` 字段）。
2. 插件同时维护 `client` 与 `client-v2` 两套代码，修改时请保持同步。
3. 生产环境如需移除调试日志，可注释 `plugin.tsx` 中的 `console.log`。
4. 水印仅在前端渲染，无法阻止高级用户通过开发者工具禁用，建议配合权限与审计使用。
