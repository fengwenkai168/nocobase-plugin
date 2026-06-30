# 更新日志

本文件记录 `@my-project/plugin-shuiyin1` 的所有重要变更。

---

## v0.2.8（2026-06-30）

### 修复
- 注销账号后水印不消失（需手动刷新）：`refreshWatermark()` 和 `renderWatermark()` 新增 `isAuthPage()` 检测，进入登录/注册等认证页面时自动移除水印 DOM，30s 内生效

---

## v0.2.7（2026-06-30）

### 修复
- 账号退出→切换登录后，水印仍显示旧用户名（需手动刷新才更新）：周期性刷新（30s）现已同步调用 `auth:check` 获取当前用户，确保登录用户名自动刷新
- `yarn nocobase upgrade` 升级流程修复，`migrateEnabledField()` 可为旧记录补充 `enabled` 字段

---

## v0.2.6（2026-06-30）

### 新增
- 设置页新增「启用水印」总开关，关闭后水印 DOM 移除，配置保留不丢失
- `upgrade()` 新增 `migrateEnabledField()` 为已有记录补充 `enabled` 默认值
- 新增 `src/common/watermark-core.ts` 公共模块，抽取 `renderWatermark`、`densityMap`、`isAuthPage` 等共享逻辑，消除 v1/v2 代码重复

### 修复
- 默认值统一：集合定义 `fontSize/density/showTime` 默认值与 `createDefaultSettings()` 及客户端保持一致（10/5/true）
- `src/index.ts` 同时导出 server 和 client 两端
- 客户端新增 `afterDisable()` → `cleanup()` 资源清理：定时器、MutationObserver、事件监听器、`history.pushState` 恢复、水印 DOM 移除
- `upgrade()` 中调用 `syncVersion()` 确保升级后版本号同步

### 优化
- `console.log` 用 `DEBUG` 常量包裹（默认关闭），减少生产环境日志输出
- `densityMap` 兜底值从 `densityMap[3]` 改为 `densityMap[5]`，与默认密度一致

### 文档
- 新增 `CHANGELOG.md`（本文件）
- 新增 `产品文档.md`
- `README.md` 更新项目结构、默认值说明、新增水印开关配置项
- 国际化新增 `"Enable watermark"` / `"启用水印"` 翻译键

---

## v0.2.5（2026-06-16）

### 修复
- 登录页面刷新后登录，水印不出现、设置菜单入口消失的问题
  - 设置菜单注册移到 `isAuthPage()` 检查前，始终注册菜单
  - 认证页面不直接返回，通过劫持 `history.pushState` + `popstate` 监听 + `requestAnimationFrame` 兜底检测路由变化
  - 用户登录后自动调用 `startup()` 初始化水印
  - 同步修改 `client-v2/plugin.tsx` 保持双端一致

---

## v0.2.4（2026-06-16）

### 修复
- 版本同步逻辑确认正常工作

### 变更
- 版本号更新

---

## v0.2.3（2026-06-16）

### 新增
- 重建 `src/` 源码目录（之前只包含编译产物）
- `nocobase` 元数据字段，支持生产环境上传
- `upgrade()` 生命周期方法

### 修复
- TypeScript 类型错误

### 变更
- `peerDependencies` 改为 `2.x` 格式（NocoBase 官方规范）

### 优化
- 重构版本同步逻辑为 `syncVersion()`，在 `load()` 中每次启动同步版本到 `_plugins` 表
- README.md 更新实现原理、数据库使用逻辑、升级生命周期文档

---

## v0.2.2（2026-06-16）

### 变更
- `peerDependencies` 从 `>=2.1.5-0` 改为 `>=2.1.9`

### 新增
- `nocobase` 元数据字段
- `keywords` 字段

---

## v0.2.0（2026-06-16）

### 修复
- 登录页、注册页等认证页面不再显示水印
- 修复认证页面 `Cannot read properties of undefined (reading 'state')` 报错

### 优化
- 插件在 `/signin`、`/signup`、`/forgot-password`、`/reset-password` 页面自动跳过水印初始化和 API 请求，避免未认证状态下请求报错

---

## v0.1.0

- 初始版本：全局水印渲染、设置页、防删除、双端兼容
