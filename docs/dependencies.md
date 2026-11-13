# 依赖升级说明

本次按 npm 官方注册表查询直接依赖的稳定版本，重新生成 `package-lock.json`。统一使用 npm，移除旧 pnpm 锁文件、Husky、Commitlint、Locize 及未再使用的旧构建和界面依赖。

## 主要版本

| 依赖 | 当前版本范围 |
| --- | --- |
| React / React DOM | 19.3.1 |
| React Router | 7.18.5 |
| MUI | 9.5.0 |
| Vite | 8.3.8 |
| Vite React 插件 | 6.3.0 |
| Tailwind CSS | 4.3.5 |
| TypeScript | 6.0.3 |
| ESLint | 10.14.0 |
| Vitest | 5.1.0 |
| PDF.js | 6.5.438 |
| React-PDF | 11.0.0 |

精确安装版本以锁文件为准。未发布更新的包保留当前稳定版本，不将其替换为测试版。

## 兼容性约束

- Node.js 要求 24 或更新版本；`.node-version` 和 `.nvmrc` 均设置为 24。
- TypeScript 7 已发布，但当前 `typescript-eslint` 声明仅支持 `<6.1.0`，因此使用其支持范围内最新的 TypeScript 6.0.3。移除已废弃的 `baseUrl` 配置，通过 `paths` 维护内部导入。
- `@imgly/background-removal` 的当前稳定版明确要求 `onnxruntime-web@1.21.0`。保留该精确版本，等待上游支持后再升级运行时。
- 图片编辑器使用稳定版 `react-filerobot-image-editor@5.0.1`，跳过被标为 latest 的 beta。其固定依赖的部分 Scaleflex 包仍声明 React 18 / styled-components 5 的旧 peer 范围，npm 会给出上游 peer 警告；未强制覆盖它们的内部版本。
- 该编辑器的 `HistoryButtons.js`、`TabsResponsive.js` 和 `TabsNavbar/index.js` 漏导入 React。Vite 中加入仅匹配这三个文件的导入修复，开发和生产构建共用；上游修复后可移除该插件。
- React-PDF 与独立 PDF.js 工具可能安装不同的 PDF.js 版本。表单编辑器通过构建别名加载 React-PDF 自己对应的本地 worker，避免 worker 版本不一致。

## 已完成的迁移

- React 19 的 JSX 类型和 `useRef` 初始化。
- MUI 9 的系统属性、Grid `size` 和表单 `slotProps`。
- Tailwind 4 的 Vite 集成；Vite 8 原生 tsconfig 路径解析。
- PDF.js 6 的文档加载参数和本地 worker 路径。
- Jimp 1 的命名导出与测试图片生成 API。
- `to-words` 7 的独立中英入口，以及小数尾零兼容。
- 移除依赖旧仓库提交号的构建逻辑。

检查命令见主 README。升级后应继续运行类型检查、语言检查、单元测试、生产构建和工作台浏览器测试。
