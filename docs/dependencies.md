# 依赖与轻量化实现

保留 React + Vite 和现有工具服务层，使用原生 HTML/CSS/SVG 替换重型组件库，避免为 134 个工具重新引入另一套 UI 框架。

## 本轮变化

| 项目                         | 改造前                      | 改造后                                     |
| ---------------------------- | --------------------------- | ------------------------------------------ |
| 直接运行时依赖               | 57                          | 45                                         |
| 锁文件包记录（含平台可选项） | 761                         | 635                                        |
| 控件与主题                   | Material UI + Emotion       | 原生控件、共享语义 CSS 变量                |
| 代码编辑                     | Monaco                      | 本地 textarea、行号与状态栏                |
| 图片编辑                     | Filerobot / Scaleflex       | 原生 Canvas                                |
| 样式构建                     | Tailwind + PostCSS 插件     | 普通 CSS                                   |
| 工具说明                     | 首屏加载全部资源            | 首屏加载目录元数据，详细选项与示例按需加载 |
| HEIC 解码                    | 两套解码器                  | 按需加载 heic-to                           |
| 固定公式计算                 | nerdamer-prime 通用符号引擎 | 16 个方向的显式公式，保留单位换算          |
| CSV／TSV 与 YAML             | 多套手工拆行和拼接          | 共用 Papa Parse 与 yaml                    |
| 栅格图像缩放                 | Canvas 默认重采样           | 执行时加载 pica，逐张处理                  |

移除 Material UI、Emotion、Monaco、Iconify、Filerobot、styled-components、react-konva、notistack、重复 HEIC 解码器、未使用的 i18next HTTP backend 等直接依赖。清除旧 pnpm 锁文件和工作区配置，统一使用 npm 与 package-lock.json。

原界面减重阶段曾降至 43 项生产依赖；调研落地后新增三个格式／图像处理内核，并移除 nerdamer-prime，当前为 45 项。公式计算器的 JS 分块由约 975 KB 降至 40.2 KB；这不代表整个站点的体积变化。实现与验收记录见[调研方案落地记录](research/implementation-2026-11-16.md)。

## 保留的功能模块

PDF 工作台以 PDF.js 预览、pdf-lib 编排和写入 PDF，并按需加载 EmbedPDF 高级编辑器与同源 PDFium WASM。FFmpeg 用于音视频处理，处理时按需加载。旧工具的界面翻译随对应工具按需加载。

图片编辑器以 Canvas 提供裁剪、旋转、画布扩展、调色、文字标注、撤销和 PNG/JPEG/WebP 导出。

PDF 压缩逐张重采样兼容的内嵌图片，并比较编码体积。选择 JPEG 2000 时，浏览器 Worker 才加载 Cornerstone OpenJPEG WASM。分发许可见 `public/licenses/`。 [OpenJPEG 编码器](https://github.com/cornerstonejs/codecs/tree/main/packages/openjpeg)

自动抠图使用 ONNX Runtime Web 的 WASM CPU 运行时，JavaScript 与 WASM 资源随同一版本构建。Node.js 要求 24 或更新版本。

图片编辑器的「纯色去底」可离线运行。「自动抠图」在点击处理后才从站点自身加载 U²-NetP 模型（约 4.6 MB）和 WASM 运行时，使用浏览器 Worker 识别主体。部署时随构建发布 `models/u2netp/` 和 `assets/` 即可。模型来源、校验值和许可见模型目录。 [U²-Net 官方项目](https://github.com/xuebinqin/U-2-Net)

## 开发与验证

运行 npm ci --ignore-scripts 后，可执行 npm run dev。predev / prebuild 会通过 scripts/generate-catalog-locales.mjs 从工具元数据生成轻量目录语言资源；修改工具名称或分类后，重新运行即可同步。

验证命令：

- npm run typecheck
- npm run i18n:check
- npm run test:run
- npm run build
- npm run test:workbench

浏览器回归覆盖全部工具的桌面与手机入口，以及关键输入、排序、处理、导出和偏好持久化。自动抠图测试验证同源模型按需加载、透明 PNG 像素和纯色回退。大型音视频转码仍需使用相应素材验证。
