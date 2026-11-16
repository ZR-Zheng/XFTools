# XFTools

简体中文实用工具集合。将图像、PDF、音视频、文本、列表、日期、数字及 JSON / CSV / XML 工具放进同一个工作台，可自行部署和维护。

![工具工作台](docs/images/workspace.png)

## 使用体验

- 分类导航与关键词搜索，支持 Ctrl / Cmd + K 聚焦搜索。
- 收藏常用工具、查看最近使用记录；偏好保存在当前浏览器。
- 根据文本、代码、对比、表格、图片、PDF、音视频、日期、计算器与生成器提供对应交互布局。
- 文件预览、批量文件排序、参数设置与显式处理；支持复制、下载及可直接应用的示例。
- 图片缩放提供联动尺寸与结果预览；PDF 可点选页面；音频显示波形与裁剪区间；时间戳和 bcrypt 使用专门表单。详见 [工具页面交互](docs/tool-interactions.md)。
- 简体中文界面；品牌 XFTools 和英文宣传语保持原文。
- 固定浅色界面，适配桌面、平板和手机，支持键盘导航与减少动态效果设置。

部分高级功能首次使用会下载 WASM、编辑器资源或机器学习模型，需要网络连接。处理较大文件时应预留足够内存。

界面使用 React + 原生 HTML/CSS/SVG，图片编辑使用 Canvas；已移除 Material UI、Emotion、Monaco、Tailwind 和 Filerobot。工具选项、示例及详细说明按分类延迟加载，首页仅加载检索所需的元数据。具体说明见 [依赖与构建](docs/dependencies.md) 和 [界面设计规范](docs/design-system.md)。

PDF 合并支持文件与页面两种整理方式、预览、重排、批量旋转／复制／删除及撤销。CSV／TSV 工具共用成熟解析内核，缩放使用按需加载的 pica；固定公式计算器已移除通用符号引擎。功能边界、体积变化与验证见[调研方案落地记录](docs/research/implementation-2026-11-16.md)。

工作台已移除顶部栏、语言切换和主题切换；侧栏底部同行展示处理状态与版本号，页内不重复展示处理状态及许可标识。详见[界面简化与问题修复](docs/interface-simplification.md)。

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

工作台浏览器回归：`npm run test:workbench`（首次需要 `npx playwright install chromium`）。包含全部工具的桌面和手机布局巡检，以及文件排序、PDF 合并与表单导出、图片编辑导出、代码编辑与侧栏导航。可设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已有 Chrome。

`npm test` 进入测试监听模式；`npm run test:e2e` 运行 Playwright 测试，首次使用需先执行 `npx playwright install` 安装对应浏览器。所有端到端功能测试使用简体中文界面。

## 部署

构建后将 `dist/` 部署到支持静态文件的服务器。使用 history 路由，服务器需将不存在的路径回退到 `index.html`。

也可以构建自己的 Docker 镜像：

```bash
docker build -t xftools .
docker run -d --name xftools --restart unless-stopped -p 8080:80 xftools
```
