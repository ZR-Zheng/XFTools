# XFTools

简体中文实用工具集合。提供图像、PDF、音视频、计算器、统计图和格式转换工具，可自行部署和维护。

![工具工作台](docs/images/workspace.png)

## 使用体验

- 分类导航与关键词搜索，支持 Ctrl / Cmd + K 聚焦搜索。
- 图片、PDF、音视频和日期工具各有适合其操作的布局。
- 文件转换器提供视频、音频、图片和 PDF 批量转换。图片压缩提供通用和 PNG 专用模式，时长换算支持单项与批量输入。
- 文件预览、批量文件排序、参数设置与显式处理；支持复制、下载及可直接应用的示例。
- 图片缩放支持联动尺寸与结果预览，PDF 可点选页面，音频显示波形与裁剪区间，时间戳使用专门表单。详见 [工具页面交互](docs/tool-interactions.md)。
- 简体中文界面；品牌 XFTools 和英文宣传语保持原文。
- 浅色磨砂玻璃界面适配桌面、平板和手机，支持键盘导航与减少动态效果设置。

部分高级功能首次使用会下载 WASM、编辑器资源或机器学习模型，需要网络连接。处理较大文件时应预留足够内存。

界面使用 React + 原生 HTML/CSS/SVG，图片编辑使用 Canvas；已移除 Material UI、Emotion、Monaco、Tailwind 和 Filerobot。工具选项、示例及详细说明按分类延迟加载，首页仅加载检索所需的元数据。具体说明见 [依赖与构建](docs/dependencies.md) 和 [界面设计规范](docs/design-system.md)。

PDF 编辑器从站内入口在新标签页打开，也可直达 `/pdf/workspace`。它支持连续预览、合并拆分、页面编排、批注、表单、压缩、密码保护、PNG／EPUB 导出、提取内嵌图片和图片转 PDF。压缩可选无损结构优化，或按画质和尺寸重新编码内嵌图片，支持 JPEG 和 JPEG 2000。 [PDF 操作与保存说明](docs/tool-interactions.md)

图片编辑器可直达 `/image/workspace`。「画布扩展」可独立设置画布宽高、前景缩放和位置，并填充透明、纯色或原图模糊背景。当前编辑结果可继续用于去背景、批量处理和分页打印。批量缩放使用按需加载的 pica。

视频编辑器可直达 `/video/workspace`。将视频、GIF、静态图片或配乐拖入工作台，用双轨时间线剪辑、混音和预览，然后在浏览器内导出 MP4、GIF 或音频。原视频与 GIF 工具地址会打开对应设置。

音频编辑器可直达 `/audio/workspace`。使用波形选区试听、裁剪和分割，在剪辑轨拼接片段，在混音轨安排配乐或旁白。

文件转换器可直达 `/converters/workspace`。选择分类、输出格式和预设，再把文件加入同一个本地队列。支持视频转码或提取音轨、GIF 动图、音频格式转换、图片转码、单页 PDF，以及从 PDF 导出页面图片、文本和 EPUB。可以单个下载或批量打包成 ZIP。

统计图画板可直达 `/charts/board`。可导入 CSV 或 TSV，绘制折线图、柱状图、饼图和象形图，并导出 PNG 或 SVG。

更新画板时，将 `LineChartAssistant/dist` 的全部内容替换到 `public/line-chart-assistant/`，让新 `index.html` 与新 `assets/` 一起发布。XFTools 会自动适配当前默认构建的 `/assets/` 入口路径。若直接更新已部署站点的静态文件，将构建内容替换到站点的 `line-chart-assistant/` 目录即可。

工具箱在首页集中展示所有工具。工作台卡片提供常用操作的直达链接。文件工作台在独立标签页打开，便于并行处理文件。 [界面与键盘操作](docs/interface-simplification.md)

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

工作台浏览器回归：`npm run test:workbench`（首次需要 `npx playwright install chromium`）。包含桌面及手机布局、工具箱快捷入口、文件排序、PDF 合并与表单导出和图片编辑导出。可设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已有 Chrome。

`npm test` 进入测试监听模式；`npm run test:e2e` 运行 Playwright 测试，首次使用需先执行 `npx playwright install` 安装对应浏览器。所有端到端功能测试使用简体中文界面。

## 部署

构建后将 `dist/` 部署到支持静态文件的服务器。使用 history 路由，服务器需将不存在的路径回退到 `index.html`。

也可以构建自己的 Docker 镜像：

```bash
docker build -t xftools .
docker run -d --name xftools --restart unless-stopped -p 8080:80 xftools
```
