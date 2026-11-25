# XFTools

XFTools 是一套可自行部署的简体中文浏览器工具，提供图片、PDF、音视频编辑，以及批量格式转换、计算器和统计图画板。文件在浏览器中处理。FFmpeg、PDFium 和自动抠图模型等资源会在使用对应功能时从站点按需加载，处理大文件时的速度和容量取决于设备性能与可用内存。

![XFTools 工具箱首页，包含搜索栏和七个工具入口](docs/images/workspace.png)

## 工具与入口

首页工具箱可以按关键词搜索工具和常用操作。按 `Ctrl` / `⌘` + `K` 聚焦搜索，按 `Enter` 打开最匹配的工具或常用操作，按 `Esc` 清除搜索。文件工作台在独立标签页打开。 [界面与键盘操作](docs/interface-simplification.md)

| 工具 | 站内路径 | 主要功能 |
| --- | --- | --- |
| 图片编辑器 | `/image/workspace` | 裁剪、旋转、调色、文字标注、纯色去底、自动抠图和分页打印。画布扩展支持调整前景大小和位置，新增区域可用透明、纯色或原图模糊背景填充。批量处理支持缩放、通用压缩和 PNG 专用压缩。 |
| PDF 编辑器 | `/pdf/workspace` | 连续预览、合并、拆分、页面排序、批注、表单填写、压缩和密码保护。支持图片转 PDF、导出 PNG 或 EPUB，以及提取内嵌图片。压缩可选择无损结构优化或重新编码内嵌图片，支持 JPEG 和 JPEG 2000。 |
| 视频编辑器 | `/video/workspace` | 在双轨时间线上剪辑视频、GIF 和静态图片，添加配乐并预览。片段可应用矩形或椭圆蒙版、羽化、淡入淡出、滑入和滤镜。支持从明文剪映草稿导入主视频轨和一段配乐，导出 MP4、GIF 或音频。 |
| 音频编辑器 | `/audio/workspace` | 波形选区试听、裁剪和分割，在剪辑轨拼接片段，在混音轨安排配乐或旁白。 |
| 文件转换器 | `/converters/workspace` | 将视频、音频、图片和 PDF 加入同一批量队列。支持视频转码、提取音轨、生成 GIF、音频和图片转码、图片转单页 PDF，以及将 PDF 导出为 PNG、JPG、TXT 或 EPUB。每个任务可独立调整输出选项，结果可逐项下载或打包为 ZIP。 |
| 计算器 | `/time/calculator` | 普通和科学计算、日期差、日期推算、年龄和工作日计算，以及时长加减和批量换算、Unix 与 Discord 时间戳和 Cron 表达式解析。 |
| 数字大写 | `/time/calculator?view=number-words` | 将数字转为中文和英文大写，支持负数、小数和千分位，也可从科学计算结果直接转换。支票金额支持港元中英文写法、人民币中文写法和美元英文写法。 |
| 统计图画板 | `/charts/board` | 导入 CSV 或 TSV，绘制折线图、柱状图、饼图和象形图，导出 PNG 或 SVG。 |

文件转换器会按输出格式显示高级选项，例如视频截取区间、分辨率和帧率，图片质量和透明区域填充，以及 PDF 页码范围、页面渲染倍率和 EPUB 元数据。旧版独立工具链接仍可打开对应模式。 [工具交互与保存说明](docs/tool-interactions.md)

## 本地开发

需要 **Node.js 24 或更新版本**。使用 npm 根据 `package-lock.json` 安装依赖。

```bash
npm ci --ignore-scripts
npm run dev
```

打开终端中 Vite 输出的本地地址。

项目使用 TypeScript、React 和 Vite，界面以原生 HTML/CSS/SVG 实现，图片编辑使用 Canvas。开发和构建命令会自动从工具元数据生成首页检索用的中文目录。 [依赖与构建](docs/dependencies.md) · [界面设计规范](docs/design-system.md)

## 验证

```bash
npm run typecheck
npm run i18n:check
npm run test:run
npm run build
```

`npm test` 以监听模式运行单元测试，`npm run serve` 在本地预览构建结果。

- `npm run test:workbench` 使用 Chromium 检查桌面和手机布局、工具入口及各工作台的操作和导出流程。首次运行前执行 `npx playwright install chromium`，也可设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已安装的 Chrome。
- `npm run test:e2e` 在 Chromium、Firefox 和 WebKit 上运行 `src/` 中的 Playwright 测试。首次运行前执行 `npx playwright install`。

## 部署

执行 `npm run build` 后，将整个 `dist/` 部署到站点根路径。服务器应直接提供静态资源，并将 `/pdf/workspace` 等前端页面路径回退到 `index.html`。请随站点发布 `assets/`、`models/` 和 `line-chart-assistant/` 等资源目录，并为 `.mjs` 配置 JavaScript MIME 类型。

仓库中的 Dockerfile 使用 Nginx 提供静态文件并配置路由回退。启动后打开 `http://localhost:8080`。

```bash
docker build -t xftools .
docker run -d --name xftools --restart unless-stopped -p 8080:80 xftools
```

### 更新统计图画板

将 `LineChartAssistant/dist/` 的构建产物整体替换到 `public/line-chart-assistant/` 后重新构建 XFTools。若直接更新已部署站点，将同一批构建产物替换到站点的 `line-chart-assistant/` 目录。`index.html` 与 `assets/` 应一起发布，XFTools 会适配画板默认构建使用的 `/assets/` 入口路径。

## 许可证

项目采用 MIT 许可证。 [LICENSE](LICENSE)
