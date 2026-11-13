# XFTools 工具工作台

中文优先、支持英文的浏览器实用工具集合。将图像、PDF、音视频、文本、列表、日期、数字及 JSON / CSV / XML 工具放进同一个工作台，可自行部署和维护。

![工具工作台](docs/images/workspace.png)

## 使用体验

- 分类导航与关键词搜索，支持 Ctrl / Cmd + K 聚焦搜索。
- 收藏常用工具、查看最近使用记录；偏好保存在当前浏览器。
- 统一的工具详情、输入输出面板、选项与可直接应用的示例。
- 简体中文默认界面，可切换英文；已补齐工具选项、说明和示例的中文文案。
- 浅色与深色主题，适配桌面、平板和手机，支持键盘导航与减少动态效果设置。

文件处理在浏览器中执行。部分高级功能首次使用会下载 WASM、编辑器资源或机器学习模型，需要网络连接；这些资源请求与本地文件处理是两回事。请在处理较大文件时为浏览器预留足够内存。

## 本地开发

需要 **Node.js 24 或更新版本**，统一使用 npm 与 `package-lock.json`。

```bash
npm ci --ignore-scripts
npm run dev
```

打开终端中 Vite 输出的本地地址。

```bash
npm run typecheck
npm run i18n:check
npm run test:run
npm run build
npm run serve
```

工作台浏览器回归：`npm run test:workbench`（首次需要 `npx playwright install chromium`）。

`npm test` 进入测试监听模式；`npm run test:e2e` 运行 Playwright 测试，首次使用需先执行 `npx playwright install` 安装对应浏览器。现有端到端功能测试使用英文环境，新工作台的测试另行覆盖中文默认与语言切换。

## 部署

构建后将 `dist/` 部署到支持静态文件的服务器。使用 history 路由，服务器需将不存在的路径回退到 `index.html`。

也可以构建自己的 Docker 镜像：

```bash
docker build -t xftools .
docker run -d --name xftools --restart unless-stopped -p 8080:80 xftools
```


## 许可证

项目使用 [MIT License](LICENSE)。许可证中原有版权及授权声明必须随软件副本或实质部分一起保留。仓库归属及后续维护可独立设置。

---

A Chinese-first, self-hosted browser toolbox with English support, category search, favorites, recent tools, and light / dark themes. Requires Node.js 24+. Use `npm ci --ignore-scripts`, `npm run dev`, and `npm run build`. File processing happens in the browser; some advanced features download runtime assets or models on first use. Released under the MIT license; retain the original copyright notice.
