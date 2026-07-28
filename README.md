

\# NocoBase 插件集合 | NocoBase Plugin Collection



\## 📖 简介 | Overview



本项目包含适用于 NocoBase 的两款自定义增强插件，分别提供\*\*全局安全水印\*\*和\*\*高性能数据导入导出\*\*能力。  

This project contains two custom enhancement plugins for NocoBase, providing \*\*global security watermarking\*\* and \*\*high‑performance data import/export\*\* capabilities.



> \*\*⚠️ 版本要求 | Version Requirement\*\*：支持 NocoBase \*\*2.1.9\*\* 及以上版本。  

> Compatible with NocoBase \*\*2.1.9\*\* and above.



\---



\## 📦 安装与使用 | Installation \& Usage



1\. \*\*获取安装包 | Get the Package\*\*  

&#x20;  从发布渠道获取插件的安装包文件。  

&#x20;  Obtain the plugin installation package from the distribution channel.



2\. \*\*登录后台 | Log in to Admin\*\*  

&#x20;  进入 NocoBase 管理后台，点击 \*\*系统设置 → 插件管理\*\*。  

&#x20;  Log in to the NocoBase admin panel and navigate to \*\*System Settings → Plugin Manager\*\*.



3\. \*\*上传安装包 | Upload the Package\*\*  

&#x20;  在插件管理页面，点击“上传”按钮，选择插件安装包并上传。  

&#x20;  On the Plugin Manager page, click the “Upload” button, select the plugin package, and upload it.



4\. \*\*重启系统 | Restart the System\*\*  

&#x20;  上传完成后，\*\*重启 NocoBase 服务\*\*，使插件被系统加载。  

&#x20;  After upload, \*\*restart the NocoBase service\*\* to load the plugin.



5\. \*\*启用插件 | Enable the Plugin\*\*  

&#x20;  重启后，再次进入插件管理，在已安装插件列表中找到对应插件，点击“启用”即可生效。  

&#x20;  After restart, go back to Plugin Manager, find the plugin in the installed list, and click “Enable” to activate it.



\---



\## 🔌 插件列表 | Plugin List



\### 1. 全局水印插件 (`plugin-shuiyin1`) | Global Watermark Plugin



\- \*\*简介 | Description\*\*：在所有页面上层覆盖动态水印，有效防止截图泄密，并具备强防篡改能力。  

&#x20; Overlays a dynamic watermark on top of all pages, effectively preventing screenshot leaks, with strong tamper‑proof capabilities.

\- \*\*核心特性 | Key Features\*\*：

&#x20; - \*\*实时防御 | Real‑time Defense\*\*：通过 `MutationObserver` 监听 DOM，水印被删除或修改时自动重建（<100ms），并阻止控制台常见的移除操作。  

&#x20;   Uses `MutationObserver` to monitor the DOM – if the watermark is removed or altered, it is automatically rebuilt within <100ms and blocks common removal attempts from the console.

&#x20; - \*\*动态刷新 | Dynamic Refresh\*\*：随路由切换、用户信息变更实时更新水印内容（支持 `{username}` 动态变量）。  

&#x20;   Updates watermark content (supports dynamic variable `{username}`) in real time upon route changes or user info updates.

&#x20; - \*\*灵活配置 | Flexible Configuration\*\*：管理员可独立设置水印文本、透明度、字体大小/颜色、旋转角度、排列密度，并可选择是否显示当前日期时间（精确到秒）。  

&#x20;   Admins can independently configure watermark text, opacity, font size/color, rotation angle, spacing density, and optionally display the current date/time (accurate to seconds).



\### 2. 数据管理插件 (`plugin-sjgl02`) | Data Management Plugin



\- \*\*简介 | Description\*\*：专为处理海量数据设计的高性能导入/导出工具，稳定支持\*\*百万行级别以上\*\*的数据操作，并提供完整的任务跟踪与权限管控。  

&#x20; A high‑performance import/export tool designed for massive data, stably handling \*\*over millions of rows\*\*, with comprehensive task tracking and permission control.

\- \*\*核心特性 | Key Features\*\*：

&#x20; - \*\*高性能导入 | High‑Performance Import\*\*：

&#x20;   - 支持文件格式：\*\*`.xls`\*\*、\*\*`.xlsx`\*\*、\*\*`.csv`\*\*（附件导入）。  

&#x20;     Supported file formats: \*\*`.xls`\*\*, \*\*`.xlsx`\*\*, \*\*`.csv`\*\* (attachment import).

&#x20;   - 采用流式读取 + 异步分片处理，内存占用平稳，可稳定处理百万行级数据。  

&#x20;     Uses streaming read + asynchronous sharding, with stable memory usage, capable of processing millions of rows.

&#x20;   - 内置数据校验（类型、必填、唯一性等）与容错回滚（全部回滚，不支持跳过错误行）。  

&#x20;     Built‑in data validation (type, required, uniqueness, etc.) and fault‑tolerant rollback (full rollback; skipping error rows is not supported).

&#x20;   - 实时显示导入进度。  

&#x20;     Real‑time import progress display.

&#x20; - \*\*高性能导出 | High‑Performance Export\*\*：

&#x20;   - 导出格式：\*\*`.xlsx`\*\* 和 \*\*`.tar.gz`\*\*（附件导出）。  

&#x20;     Export formats: \*\*`.xlsx`\*\* and \*\*`.tar.gz`\*\* (attachment export).

&#x20;   - 基于内存分块写入与流式生成，避免 OOM（内存溢出），确保\*\*数百万行以上\*\*数据导出稳定。  

&#x20;     Based on memory chunked writing and streaming generation, avoiding OOM (out‑of‑memory), ensuring stable export for \*\*over millions of rows\*\*.

&#x20;   - 支持异步后台导出，不阻塞用户操作。  

&#x20;     Supports asynchronous background export without blocking user operations.

&#x20; - \*\*任务追踪中心 | Task Tracker\*\*：

&#x20;   - 每个导入/导出任务独立状态：待处理、运行中、已完成、失败。  

&#x20;     Each import/export task has an independent status: Pending, Running, Completed, Failed.

&#x20;   - 实时进度条与处理行数统计。  

&#x20;     Real‑time progress bar and row count statistics.

&#x20;   - 完整的操作日志（时间、操作人、错误详情），便于审计与排查。  

&#x20;     Complete operation logs (time, operator, error details) for auditing and troubleshooting.

&#x20;   - 支持手动取消正在运行的任务。  

&#x20;     Supports manual cancellation of running tasks.

&#x20; - \*\*细粒度权限控制 | Fine‑grained Permission Control\*\*：

&#x20;   - 基于 Collection（数据表）和 Tab（视图）维度，控制导入/导出权限。  

&#x20;     Controls import/export permissions based on Collection (tables) and Tab (views).

&#x20;   - 集成 NocoBase 原生 ACL，与用户角色绑定，满足多租户数据隔离与合规要求。  

&#x20;     Integrates with NocoBase native ACL, bound to user roles, meeting multi‑tenant data isolation and compliance requirements.



\---



\## 📞 联系我们 | Contact Us



如有安装、使用或定制需求，欢迎联系我们。  

For installation, usage, or customization inquiries, feel free to contact us.



\- 📧 Email: \[1334409979@qq.com](mailto:1334409979@qq.com)

\- 🌐 Gitee: https://gitee.com/fengwenkai/nocobase-plugin/

\- 🌐 GitHub: https://github.com/fengwenkai168/nocobase-plugin



\---



> \*\*说明 | Note\*\*：以上功能描述基于仓库最新代码及更新日志整理，具体以实际发布版本为准。  

> The above feature descriptions are based on the latest repository code and changelog. Please refer to the actual released version for details.



\---



