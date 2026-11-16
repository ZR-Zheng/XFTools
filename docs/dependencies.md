# 依赖与轻量化实现

保留 React + Vite 和现有工具服务层，使用原生 HTML/CSS/SVG 替换重型组件库，避免为 134 个工具重新引入另一套 UI 框架。

## 本轮变化

| 项目 | 改造前 | 改造后 |
| --- | --- | --- |
| 直接运行时依赖 | 57 | 43 |
| 锁文件包记录（含平台可选项） | 761 | 631 |
| 控件与主题 | Material UI + Emotion | 原生控件、共享语义 CSS 变量 |
| 代码编辑 | Monaco | 本地 textarea、行号与状态栏 |
| 图片编辑 | Filerobot / Scaleflex | 原生 Canvas |
| 样式构建 | Tailwind + PostCSS 插件 | 普通 CSS |
| 工具说明 | 首屏加载全部资源 | 首屏加载目录元数据，详细选项与示例按需加载 |
| HEIC 解码 | 两套解码器 | 按需加载 heic-to |

移除 Material UI、Emotion、Monaco、Iconify、Filerobot、styled-components、react-konva、notistack、重复 HEIC 解码器、未使用的 i18next HTTP backend 等直接依赖。清除旧 pnpm 锁文件和工作区配置，统一使用 npm 与 package-lock.json。

## 保留的功能模块

PDF.js、React-PDF、pdf-lib 与 PDF 编辑 SDK 用于不同 PDF 工具；FFmpeg 用于音视频处理；Tesseract 与背景移除运行时用于 OCR 和去背景。这些较重模块按工具路由或首次需要解码时加载。大型 WASM、OCR、模型处理仍可能需要下载资源。

图片编辑器提供旋转、翻转、百分比裁剪、亮度、对比度、饱和度、文字标注、撤销与 PNG/JPEG/WebP 导出；不再加载旧编辑 SDK。React-PDF 继续从自身对应的 PDF.js 版本加载 worker，避免版本不一致。

onnxruntime-web 仍固定为 1.21.0，以满足背景移除库的兼容要求。Node.js 要求 24 或更新版本。

## 开发与验证

运行 npm ci --ignore-scripts 后，可执行 npm run dev。predev / prebuild 会通过 scripts/generate-catalog-locales.mjs 从工具元数据生成轻量目录语言资源；修改工具名称或分类后，重新运行即可同步。

验证命令：

- npm run typecheck
- npm run i18n:check
- npm run test:run
- npm run build
- npm run test:workbench

浏览器回归覆盖全部工具的桌面与手机入口，以及关键输入、排序、处理、导出和偏好持久化。大型音视频转码及在线模型下载未纳入逐项完整处理验收。
