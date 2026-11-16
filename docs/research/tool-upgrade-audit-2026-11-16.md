# XFTools 全工具替代与升级调研

调研日期：**2026-11-16（Asia/Shanghai）**。范围：当前 **134 个工具入口、package.json 声明的 43 项生产依赖**。交付包含逐项对比、PDF 合并专项方案和整体工具链路线；本轮没有安装替代依赖或修改工具运行逻辑。

**建议采用“保留轻量外壳、修复共享内核、按任务扩展工作区”的升级方式。** PDF、结构化数据和媒体处理值得实质增强；普通文本、列表与固定公式大多不需要替换成更大的 SDK。完整外部工具站适合做功能／交互对标，不应为每个入口再嵌入一套应用。

本报告已为 134 个入口分别给出当前实现、候选／替代路线、功能差异、具体建议和优先级／投入等级。没有发现可确定更优的等价轻量替代时，明确写为保留／原生升级，不虚构“所有工具都有更强第三方包”。

## 1. 阅读方式与调研边界

- [逐工具对比矩阵](tool-upgrade-matrix-2026-11-16.json)：134 条结构化记录及 55 项来源，便于筛选与后续排期。
- [正确性复现记录](correctness-repros-2026-11-16.json)：直接执行当前 CSV／JSON 比较纯函数得到的结果。
- 本文第 3 节重点回答 PDF 合并的升级方案；第 5 节逐项覆盖全部工具；第 6 节给出实施路线；第 7 节记录一手来源、许可证及部署边界。

方法：逐项核对路由与页面策略，扫描对应 meta、页面、service、配置与导入依赖；深入审读共享 CSV、JSON 比较、图片透明化、PDF、媒体任务队列等关键路径。外部信息优先使用官方文档、官方仓库与标准，避免用星标、排行榜或“推荐软件榜单”判断可集成性。

证据级别：**当前代码事实**来自仓库；**候选公开能力**来自链接文档；**建议和优先级**是本次工程判断。未逐个安装外部候选，也未做全格式速度／质量基准，因此不承诺“替换后一定快几倍”“所有 PDF 无损保留所有结构”或“任何浏览器都支持同样的编码器”。最新文档与当前锁定版本可能不同，特别是 EmbedPDF、图像 codecs、XML 模块和 to-words。

## 2. 当前项目最值得先处理的差距

| 发现 | 当前事实与证据 | 影响与处理 |
| --- | --- | --- |
| E1：透明 PNG 与标题不符 | [透明化页面](../../src/pages/tools/image/generic/create-transparent/index.tsx)命中目标颜色后设置 RGB 为背景色、alpha 为 `255`；真正透明化的 `alpha=0` 行被注释。 | 这是替换背景，不是变透明。P0：拆成“指定色透明化／替换背景”，对实际像素验收。 |
| E2：CSV 引用字段内换行会拆错 | [共享 CSV 解析器](../../src/utils/csv.ts)先 `split('\n')`；[CSV→JSON](../../src/pages/tools/csv/csv-to-json/service.ts)另有同类逐行实现。实际执行 `name,note\nAlice,"hello\nworld"`，期望 2 行，得到 3 行。 | P0：统一成熟解析／写出器，而非分别修补 11 个入口。候选 [Papa Parse](https://www.papaparse.com/docs)支持相应引用、错误和文件处理配置。 |
| E3：YAML 直接拼接值 | [CSV→YAML](../../src/pages/tools/csv/csv-to-yaml/service.ts)用 `${key}: ${value}` 拼接。冒号、井号、换行和类型字面量没有通过 YAML writer。 | P0：改为 [yaml](https://eemeli.org/yaml/) 序列化，默认保持 CSV 字符串；此项为源码静态发现，未在本轮运行所有 YAML 反例。 |
| E4：JSON 对比会改写合法内容 | [JSON 比较](../../src/pages/tools/json/json-comparison/service.ts)在解析前用正则删除“尾逗号”。实际比较 `{"text":",}"}` 与 `{"text":"}"}`，返回 `No differences found`。 | P0：普通解析不能自动修复原文。先恢复严格语义，再接入结构化 diff；修复应为单独、可预览操作。 |
| E5：PDF 合并缺页级工作区 | [合并页面](../../src/pages/tools/pdf/merge-pdf/index.tsx)和[合并实现](../../src/pages/tools/pdf/merge-pdf/service.ts)按文件数组复制全部页面；[批量输入](../../src/components/input/MultiFileInput.tsx)已有上／下移，但 PDF 预览只是文件图标。 | P1 首个核心交付：文件组排序＋页缩略图＋跨文件页计划。不能误写成“当前完全不能排序”。 |
| E6：PDF→EPUB 只处理抽出的文本 | [转换实现](../../src/pages/tools/pdf/pdf-to-epub/service.ts)逐页 `getTextContent()`，再自建 EPUB2 结构。 | 现能力是基本文字提取，不是复杂版面重排；[Calibre](https://manual.calibre-ebook.com/conversion.html#pdfconversion)也明确说明 PDF 转换限制。高级模式应独立设计。 |
| E7：少量固定公式依赖通用 CAS | 五个[公式工具](../../src/pages/tools/number/generic-calc/index.tsx)共用 nerdamer-prime 和 js-quantities。当前已有构建中该 route chunk 约 974.79 kB、gzip 349.30 kB。 | 优先验证五个已知公式能否直接计算，保留单位层；不要为“升级”默认再引入完整 math.js。 |

两项运行复现见[记录](correctness-repros-2026-11-16.json)。上述发现不是在说所有输入均失败，也不是把现有入口加载测试视为语义验证。

同时应保留已有成果：文件工具已要求显式处理；批量文件已有按钮排序；缩放页已有宽高联动和 ZIP；音频裁剪已有波形和选区播放；时间戳与 bcrypt 已有专用表单；FFmpeg 已有单实例、串行队列和临时文件清理。后续应在这些基础上扩展，避免重复建设。

## 3. PDF 合并专项：建议升级为页面编排工作区

### 3.1 当前缺口与候选比较

| 方案 | 文件排序与页面预览 | 页级编排与扩展 | 处理位置／接入判断 |
| --- | --- | --- | --- |
| 当前 XFTools | 文件上／下移已有；合并输入没有子页缩略图 | 整份复制；页面选择、旋转目前分散在其他工具 | 浏览器本地；已有引擎可保留，主要补状态模型和 UI |
| [PDF24 Merge](https://tools.pdf24.org/en/merge-pdf) | 官网明确列出文件拖排、Page mode 与页面选择 | 列出书签、空白页、封面、目录等；未实测其合并页内所有旋转／删除细节 | 此在线页面说明服务器处理；作为体验对标，不作为本地 npm 引擎或默认外传方案 |
| [BentoPDF](https://github.com/alam00000/bentopdf) | 页面组织与集成查看器，适合浏览器工作区对标 | Multi Tool 将 merge/split/organize/delete/rotate/duplicate 等放入同一流程 | 浏览器产品；可参考完整实现，但 AGPL／商业与第三方 WASM 许可、构建范围须分别核验 |
| [Stirling PDF](https://docs.stirlingpdf.com/Tools/Guides/Page-Operations/) | 文件拖排、按文件名／日期排序；文档指向可视 Page Editor | 合并目录、多种拆分与组织模式；整个产品工作流更丰富 | 桌面／浏览器／自托管 API；适合作为可选服务或对标，不默认整体并入前端 |
| [PDF Arranger](https://github.com/pdfarranger/pdfarranger) | 可交互页面组织，适合作为页编排手感基准 | 合并、拆分、旋转、裁剪、重排 | Python/GTK 桌面应用，不是 Web 组件；借鉴交互，不用 iframe 包装代替集成 |
| [EmbedPDF](https://www.embedpdf.com/docs/engine) | 当前文档包含页面编辑相关能力；项目已用其 SDK | 旋转、重排、删除、插入、提取／合并等可评估统一 | 按现有锁版做 PoC，核对 API／运行时／许可证；不能把最新 API 当成现装版本已有 |
| 推荐首选：现 PDF.js＋pdf-lib | 自研文件组／缩略图界面，复用现预览与生成能力 | 用统一 PagePlan 驱动合并、提取、旋转、删除、复制 | 依赖增量最小；[pdf-lib](https://pdf-lib.js.org/)本就支持页面复制与增删。书签／表单等跨文档结构需要额外实现与验收 |

**PDF 产品候选首推 BentoPDF Multi Tool；XFTools 内部的低依赖实现路线首选现有 PDF.js＋pdf-lib。** 二者不是同一种交付：前者可先独立部署做产品 PoC；后者能保留现有技术栈并控制依赖，但需要自行实现页面编排。并行小范围验证 EmbedPDF 页面编辑能力能否减少长期维护成本。

本次还核对了 [BentoPDF 2.8.11 发布说明](https://github.com/alam00000/bentopdf/releases/tag/v2.8.11)（2026-10-31）。其 Multi Tool 更新明确列出页面导入、剪切／复制／粘贴／替换、分组拆分、逐页或批量旋转删除、拖动重排和缩略图尺寸控制，因此它是用户所述“合并时同时预览、调整顺序”需求的强候选。这里引用的是已核对版本的公开能力，不照搬其宣传性能，也不假定无需版本及许可评估即可嵌入本项目。

三种采用方式应单独决策：**自研轻量工作区**适合长期保留 XFTools 体验；**独立部署 BentoPDF**适合快速获得完整 PDF 产品能力并做对照验证；**可选 Stirling 服务**适合同时需要服务器端转换／OCR／批处理的部署。完整产品不能被误当成替换 `mergePdf()` 的一个函数。

### 3.2 用户流程与最小功能集

1. 导入多个 PDF 后显示文件卡片：名称、页数、体积、首屏缩略图、解锁状态。文件组支持拖排，也保留上／下移和键盘操作。
2. 在“文件模式”中调整 A、B、C 的整体合并顺序；展开任一文件可预览其全部页面。
3. 切换“页面模式”，按最终顺序平铺缩略图；可跨文件移动、选择／排除、复制、逐页旋转、插入空白页；显示来源文件与原页码。
4. 同一套选择状态支持 Ctrl/Shift 多选、前移／后移、撤销／重做。预览任一页无需先输出合并文件。
5. 右侧持续显示最终页数、文件分组、目标名称和导出选项；导出按页计划复制原页面，不先渲染为 PNG，保留文本／向量基础能力。
6. 对书签、表单字段重名、批注、加密文件和数字签名明确制定策略并验证。不能假定 `copyPages()` 自动保留全部文档级结构；修改后的原签名也不能宣称继续有效。

建议核心数据结构：

```ts
type PdfPageInstance = {
  id: string;                    // 每个实例独立 id，允许复制同一原页
  sourceId: string;              // 指向导入文件，不复制大文件内容
  pageIndex: number;             // 原文件零起始页码
  rotation: 0 | 90 | 180 | 270;  // 相对原页的变换
  included: boolean;
};
type PdfPagePlan = PdfPageInstance[]; // 数组顺序就是最终输出顺序
```

缩略图虚拟化、按视口渲染、有限缓存和及时释放位图应从第一版设计进去；页编排对象只保存引用。重复导入、移除源文件、运行取消和失败重试都通过稳定 id 管理，避免以文件名或数组位置充当永久身份。

### 3.3 可验收的 PDF 合并用例

| 用例 | 验收要求 |
| --- | --- |
| A 有 3 页、B 有 2 页，文件顺序 B→A | 输出必须为 B1、B2、A1、A2、A3；缩略图顺序与实际 PDF 一致 |
| 跨文件页编排 | 将计划改为 B1、A3、B2、A1，A2 不导出；实际页尺寸与来源逐页核对 |
| 旋转、复制和撤销 | B1 旋转 90°、复制 A3，预览／页数／导出一致；撤销后真正回到前一计划 |
| 有文本、链接、书签、表单的文件 | 文本仍可选；其余结构按明确策略分别检验，不能只断言输出能打开 |
| 受保护、损坏、超大、同名文件 | 明确失败位置，不静默漏页；正确处理密码、取消与重试；不要因同名文件丢失实例 |
| 100／500／2000 页测试集 | 测量导入、首屏、拖排响应、导出耗时及峰值内存；这些是计划测试规模，不是已通过的性能承诺 |

## 4. 整体工具链如何升级而不重新臃肿

### 4.1 保留轻量 UI，按领域合并能力

| 领域 | 推荐默认方案 | 条件增强 | 不建议 |
| --- | --- | --- | --- |
| 文本／列表／编码 | 原生 JS、Intl、现有 diff／bcrypt 等小库 | 共享文本／字节模型、Worker、大输入导出；按需校验函数 | 为几十个简单字符串操作整体嵌入 IT Tools／CyberChef 或重新更换应用框架 |
| JSON／CSV／XML | Papa Parse、yaml、原生 JSON 解析、现 XML 引擎 | Ajv、jsondiffpatch、可选 vanilla-jsoneditor；XML 独立模块／XSD PoC | 继续维护多份逐行 CSV 解析器、隐式修改 JSON、字符串拼接 YAML |
| PDF | 统一 PagePlan；复用 PDF.js＋pdf-lib | EmbedPDF 版本对齐；加密／结构优化按需 qpdf 构建或可选服务 | 同时在每个 PDF 页面独立加载一套编辑器，或渲染成图片后再合并 |
| 图像／动画 | Canvas、已有裁切组件、现模型 | pica＋单格式 jSquash；复杂格式才加载 magick-wasm；帧管线按需 PoC | 为单个透明度／旋转工具引入完整商业编辑 SDK；把 gifenc 当所有视频 GIF 的通用质量升级 |
| 音视频 | 保留现 FFmpeg 单实例与串行队列 | [Mediabunny](https://mediabunny.dev/guide/introduction)作为支持 codec 的快速路径；[WaveSurfer](https://wavesurfer.xyz/docs/)仅按需求承担波形／选区 | 把 WaveSurfer 当成转码器；认为所有浏览器 WebCodecs 能力相同；所有操作固定重编码 MP4 |
| 时间／数值／公式 | 继续复用 Day.js，固定公式优先原生 | decimal.js、cron-parser、Temporal 语义验证；大型表达式工具才评估 math.js | 同时默认加载多个日期库／完整 CAS；用 Number 处理所有大整数或纳秒时间 |

### 4.2 建议采用的公共执行层

保留 134 个可搜索入口和原 URL，把它们变为少量共享工作区的预设。不要为了合并代码而取消用户能找到的具体工具名称。

- **数据模型**：Text、Bytes、Table、JsonValue、ImageSequence、PdfPagePlan、AudioTimeline、VideoTimeline；格式转换先解析成明确模型，再执行操作、再序列化。
- **资源仓库**：以 id 引用 File／Blob／已打开文档，不在组件间反复复制巨型数据。保存工作进度应由用户选择；共享链接只保存配置，不塞入文件或密码。
- **引擎注册表**：记录输入／输出类型、支持格式、实际 MIME、执行位置、资源 URL／版本、能力检测、取消方式及加载状态。现有 catalog／experiences 继续管理发现与页面，不承担所有引擎细节。
- **任务调度**：文本短任务直接运行，较重任务放 Worker；沿用已有 FFmpeg 队列与临时文件清理，扩展统一进度、取消、失败重试、结果失效和资源释放。不是重新实现一套队列。
- **快路径与回退**：兼容的无重编码操作／WebCodecs 优先验证，FFmpeg 负责兼容；接口统一但不隐藏质量／编码策略。大任务的可选服务端模式由管理员配置、用户明确选择。
- **流程衔接**：上一结果可“继续到”另一兼容工具，例如 PDF 选页→合并→压缩，图像裁剪→缩放→WebP，CSV 清洗→列映射→JSON；保留原资源和可撤销操作，而不是下载后再上传。

### 4.3 体积与授权的现实约束

当前已有构建的应用主 JS 约 361.62 kB、gzip 110.25 kB；通用公式 chunk 约 974.79 kB，HEIC 解码 chunk 约 3.23 MB，ONNX WASM 文件约 23.91 MB。这些是不同路由／按需资产，**不能相加后当成首页下载体积**，也不是本轮对候选版本的性能对比。

按实际任务首次加载 codec／模型，缓存已确认版本的资源，提供离线资源包选择；不要为实现离线而强制首屏下载所有 WASM。新组件必须计入路由增量、压缩体积、首次可用时间及峰值内存，不能只数 npm 包个数。

授权直接影响“能否采用”，但本报告不作最终法律判断：IT Tools 标为 GPL-3.0，BentoPDF／Scribe／当前 IMG.LY 背景移除涉及 AGPL，Stirling 为带目录级例外的 open-core；[ffmpeg.wasm 官方 FAQ](https://ffmpegwasm.netlify.app/docs/faq/)也明确区分 wrapper 与 core／外部库许可。不能因 XFTools 根项目写 MIT 就推断所有现有和候选组件均可按 MIT 分发。参考行为与复制源码、安装库、嵌入完整产品，是不同接入方式。具体锁版和所带模型、字体、codec／WASM 均应记录来源及许可。


## 5. 全部 134 个工具逐项对比

本表的“候选”区分完整产品、组件与自研升级。写明“保留”的条目仍给出体验对标或代码升级路径；没有证据说明更换库能更好时，不虚构一个更强替代品。完整应用、桌面工具不能直接作为 React 组件安装。来源链接用于支持候选的公开能力；优化建议、优先级和投入等级是本次源码审查后的判断。

优先级：**P0** 正确性修复；**P1** 核心能力／常用体验；**P2** 增强；**P3** 低收益优化。投入：**S** 局部修改；**M** 共享组件／引擎接入；**L** 新工作区、复杂兼容或可选服务；不是工期承诺。

### 图像与 PNG（15 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 1. [图像编辑器](../../src/pages/tools/image/generic/editor/index.tsx)<br>`image-generic/editor` | 原生 Canvas；旋转、裁剪、色彩、文字及撤销。 | Pintura（完整商业 SDK）；Cropper.js＋保留 Canvas（轻量组件路线）<br>[Pintura](https://pqina.nl/pintura/)、[Cropper.js](https://fengyuanchen.github.io/cropperjs/) | Pintura 提供更完整的标注、触屏操作与可恢复编辑状态；不是免费开源包替换。 | 优先保留轻量工作区，增加可拖动选区、缩放、撤销历史；需要完整标注产品时再做 Pintura 成本验证。 | P1／L |
| 2. [调整图像大小](../../src/pages/tools/image/generic/resize/index.tsx)<br>`image-generic/resize` | 已支持宽高联动、百分比、批量预览和 ZIP；栅格用 Canvas 缩放。 | pica；交互对标 Squoosh / iLoveIMG<br>[pica](https://raw.githubusercontent.com/nodeca/pica/master/README.md)、[Squoosh](https://github.com/GoogleChromeLabs/squoosh)、[iLoveIMG Resize](https://www.iloveimg.com/resize-image) | 主要增益是重采样质量、分块与 Worker 处理，而非再换一套页面框架。 | 在现有页面内按需接入 pica；补 EXIF 方向、质量对照和大图内存测试；SVG、GIF 继续分流。 | P1／M |
| 3. [压缩图像](../../src/pages/tools/image/generic/compress/index.tsx)<br>`image-generic/compress` | browser-image-compression＋批量 ZIP。 | jSquash 编码器；Squoosh 对比体验<br>[jSquash](https://github.com/jamsinclair/jSquash)、[Squoosh](https://github.com/GoogleChromeLabs/squoosh) | 可显式选择编码格式、编码参数并对照质量；不能只用统一的 quality 参数代表全部编码器。 | 保留快速压缩模式，增加可选高级编码面板与压缩前后对照；根据收益加载单一 codec。 | P1／M |
| 4. [移除图片背景](../../src/pages/tools/image/generic/remove-background/index.tsx)<br>`image-generic/remove-background` | IMG.LY background-removal＋ONNX。 | 保留现引擎；评估 magick-wasm 辅助处理和蒙版编辑<br>[IMG.LY background-removal](https://github.com/imgly/background-removal-js)、[magick-wasm](https://github.com/dlemstra/magick-wasm) | 换另一个模型不必然提升本项目素材质量；真正缺口是发丝边缘与手动修补、批处理反馈。 | 先补擦除／恢复画笔、边缘羽化、原图对照和模型缓存；新模型必须用同一素材集实测，先核验现有 AGPL 授权路径。 | P1／L |
| 5. [裁剪图片](../../src/pages/tools/image/generic/crop/index.tsx)<br>`image-generic/crop` | 输入 x、y、宽、高，Canvas 裁切；支持矩形／圆形。 | Cropper.js；已有 react-image-crop 也可复用<br>[Cropper.js](https://fengyuanchen.github.io/cropperjs/)、[Pintura](https://pqina.nl/pintura/) | 交互式选框、拖动、缩放与比例约束明显优于只输入坐标；裁切本身无需重型编辑器。 | 优先使用项目已安装的裁切组件，选框和像素字段双向同步；圆形作为导出蒙版。 | P1／M |
| 6. [更改图像不透明度](../../src/pages/tools/image/generic/change-opacity/index.tsx)<br>`image-generic/change-opacity` | Canvas 逐图调整 alpha。 | 原生实时预览升级；Pintura 仅作体验对标<br>[Pintura](https://pqina.nl/pintura/) | 独立不透明度功能没有必要引入完整编辑 SDK；棋盘背景和滑块反馈比引擎替换更有价值。 | 使用 0–100% 滑块、数值输入、背景切换和原图／结果对照，保留轻量算法。 | P2／S |
| 7. [改变图像的颜色](../../src/pages/tools/image/generic/change-colors/index.tsx)<br>`image-generic/change-colors` | Canvas 像素替色＋相似度。 | magick-wasm；轻量模式保留 Canvas<br>[magick-wasm](https://github.com/dlemstra/magick-wasm) | ImageMagick 提供更广的图像操作基础；单色替换仍可由现有代码胜任。 | 先增加吸管、容差选区预览、保留 alpha 与撤销；复杂色彩空间功能再启用 WASM。 | P1／M |
| 8. [创建透明 PNG](../../src/pages/tools/image/generic/create-transparent/index.tsx)<br>`image-generic/create-transparent` | 名称声称透明化；实际命中颜色后替换背景色并设置 alpha=255。 | 修正原生 alpha 蒙版；magick-wasm 为高级候选<br>[magick-wasm](https://github.com/dlemstra/magick-wasm) | 当前是功能语义错误，不能靠换皮解决；透明化和替换背景应是两个明确操作。 | 先恢复命中像素 alpha=0，并用像素级样例验收；再加吸管、边缘羽化和蒙版预览。 | P0／S |
| 9. [图像转文本 (OCR)](../../src/pages/tools/image/generic/image-to-text/index.tsx)<br>`image-generic/image-to-text` | Tesseract.js 图片识别。 | Scribe.js / Scribe OCR；复杂文档可选 PaddleOCR 服务<br>[Tesseract.js](https://github.com/naptha/tesseract.js)、[Scribe.js / Scribe OCR](https://github.com/scribeocr/scribe.js)、[PaddleOCR PP-StructureV3](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PP-StructureV3.en.md) | Scribe 支持图像和 PDF 文本提取、可搜索 PDF；PaddleOCR 文档分析适合版面、表格等需求，不能直接当浏览器小组件。 | 浏览器基础 OCR 保留 Tesseract，复用 worker；高级文档模式 PoC Scribe，补文本框校对、置信度与批量；服务端模式单独选择。 | P1／L |
| 10. [二维码生成器](../../src/pages/tools/image/generic/qr-code/index.tsx)<br>`image-generic/qr-code` | qrcode；已有 URL、文本、邮件、电话、SMS、Wi-Fi、vCard 模板及纠错级别。 | 保留 qrcode；qr-code-styling 作为可选美化模式<br>[node-qrcode](https://github.com/soldair/node-qrcode)、[qr-code-styling](https://github.com/kozakdenys/qr-code-styling) | 现有模板并不弱；候选增益是 Logo、样式与 SVG 输出，不是重复增加已存在的 Wi-Fi 模板。 | 先补 SVG 导出与扫描回读测试；美化模式独立按需加载，防止样式损害可读性。 | P2／M |
| 11. [旋转图像](../../src/pages/tools/image/generic/rotate/index.tsx)<br>`image-generic/rotate` | Canvas／SVG／FFmpeg 按格式处理旋转。 | 轻量 Canvas 变换工作区；magick-wasm 为扩展<br>[magick-wasm](https://github.com/dlemstra/magick-wasm)、[Pintura](https://pqina.nl/pintura/) | 需要实时角度、翻转和可见裁边策略；更换通用图像引擎不自动实现 JPEG 无损旋转。 | 合并到图像变换工作区，补任意角度与背景填充；保留旧路由为预设入口。 | P2／M |
| 12. [图片添加水印](../../src/pages/tools/image/generic/watermark/index.tsx)<br>`image-generic/watermark` | Canvas 图片／文字水印，批量处理。 | Pintura 标注体验；保留现渲染器<br>[Pintura](https://pqina.nl/pintura/) | 位置、缩放、重复平铺、边距和字体预览比长参数表更直接；完整 SDK 有额外成本。 | 提供可拖动水印、九宫格定位、平铺、字号／透明度预览和模板保存。 | P1／M |
| 13. [图片分页打印](../../src/pages/tools/image/generic/split/index.tsx)<br>`image-generic/split-to-pages` | 图片切片并用 pdf-lib 生成打印 PDF。 | BentoPDF Posterize / PDF24 交互对标<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[PDF24 Merge PDF](https://tools.pdf24.org/en/merge-pdf)、[pdf-lib](https://pdf-lib.js.org/) | 更好的流程强调纸张、缩放、出血和拼接预览；候选完整产品不能当作 npm 包直接塞入。 | 做可缩放分页网格，显示纸张、重叠边、方向和页数；复用 PDF 页面模型与 pdf-lib。 | P1／M |
| 14. [压缩 PNG](../../src/pages/tools/image/png/compress-png/index.tsx)<br>`png/compress-png` | 自研调色板量化、抖动、大小预算、原尺寸保留与批量 ZIP。 | jSquash / oxipng 路线；Squoosh 对照体验<br>[jSquash](https://github.com/jamsinclair/jSquash)、[Squoosh](https://github.com/GoogleChromeLabs/squoosh) | 现有已经支持目标大小和调色板，不应当作单纯 Canvas toBlob；增益是无损优化与成熟编码器对照。 | 分开“无损优化”和“有损减色”；保留原图回退，按同一 PNG 集对体积、透明度和质量做 A/B。 | P1／M |
| 15. [JPG 转 PNG](../../src/pages/tools/image/png/convert-jgp-to-png/index.tsx)<br>`png/convert-jgp-to-png` | Canvas 转换并支持指定颜色透明化。 | 保留 Canvas；与颜色蒙版／格式转换工作区合并<br>[magick-wasm](https://github.com/dlemstra/magick-wasm) | JPG 转 PNG 无法找回已损失的细节；指定颜色透明化可共享同一个蒙版引擎。 | 保留现功能，增加透明蒙版预览和实际 MIME／文件名一致性检查，取消重复实现。 | P2／S |

### 文本、编码与安全（30 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 16. [拆分文本](../../src/pages/tools/string/split/index.tsx)<br>`string/split` | 已有符号／正则／固定长度／等份拆分。 | CyberChef 配方式拆分；原生分段器<br>[CyberChef](https://github.com/gchq/CyberChef)、[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 更强体验是分隔结果可视化、数量与正则错误定位；并非需要整包 CyberChef。 | 分隔符提供转义预览、匹配高亮、字素长度模式、空项策略和可选表格结果；大输入在 worker 执行。 | P1／M |
| 17. [合并文本](../../src/pages/tools/string/join/index.tsx)<br>`string/join` | 按连接符拼接文本片段。 | 原生列表工作区；CyberChef 作流程对标<br>[CyberChef](https://github.com/gchq/CyberChef) | 已有核心能力足够；候选价值是输入项数、空行与转义符可解释。 | 共享 List 引擎，增加粘贴列表预览、每项前后缀、输出长度和一键反向拆分。 | P2／S |
| 18. [删除重复的行](../../src/pages/tools/string/remove-duplicate-lines/index.tsx)<br>`string/remove-duplicate-lines` | 按选项去重文本行。 | 原生 Set／Map 管线；IT Tools 体验对标<br>[IT Tools](https://github.com/CorentinTh/it-tools) | 无需新增依赖；保留首／末项、大小写规则、频次与删除数量更实用。 | 同列表去重共用引擎，明确是否保序，增加保留／移除行的对照。 | P1／S |
| 19. [Morse 编码与解码](../../src/pages/tools/string/to-morse/index.tsx)<br>`string/to-morse` | morsee 编码／解码。 | CyberChef Morse 处理流程；现库保留候选<br>[CyberChef](https://github.com/gchq/CyberChef) | 没有证据说明为 Morse 单项换库会更好；自定义点划、分隔符和无法编码字符反馈更重要。 | 先用字母、数字、标点和非法信号做兼容样例，再加播放节奏及逐字符对应预览。 | P2／M |
| 20. [文本替换器](../../src/pages/tools/string/text-replacer/index.tsx)<br>`string/replacer` | 字符串／正则替换。 | CyberChef Find/Replace 体验；原生 RegExp<br>[CyberChef](https://github.com/gchq/CyberChef) | 匹配计数、捕获组和逐处预览比直接输出全文更方便；复杂正则须隔离执行。 | 加命中高亮、替换前后对照、保留组说明和 worker 超时／取消。 | P1／M |
| 21. [重复文本](../../src/pages/tools/string/repeat/index.tsx)<br>`string/repeat` | 按次数重复文本。 | 原生文本管线；无已证实更强的轻量等价组件<br>[CyberChef](https://github.com/gchq/CyberChef) | 算法没有更换库的必要；大次数容易造成巨大输出，需输出规模预览。 | 显示预计字符／字节数、分隔符和数量限制，超大结果使用文件输出。 | P3／S |
| 22. [截断文本](../../src/pages/tools/string/truncate/index.tsx)<br>`string/truncate` | 按长度截断文本。 | Intl.Segmenter 字素截断<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 按用户可见字素截断能避免切开组合字符与 emoji；属于明确的语义升级。 | 同时提供字素／码点／UTF-16／字节模式，标注单位和省略号是否计入上限。 | P1／S |
| 23. [反转文本](../../src/pages/tools/string/reverse/index.tsx)<br>`string/reverse` | 反转字符串。 | Intl.Segmenter 字素反转<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 可保留 emoji 联字与组合字符；普通 split 或码点反转不一定保留可见字符。 | 默认按字素反转，可选按词／行反转；用家庭 emoji 和组合音标验收。 | P1／S |
| 24. [随机转换大小写](../../src/pages/tools/string/randomize-case/index.tsx)<br>`string/randomize-case` | 使用 Math.random 随机转换大小写。 | 原生大小写变换＋可复现随机种子模式<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 这是文本效果，不需宣称安全随机；复现参数与预览比引入新库更有价值。 | 提供随机种子、比例和语言选项；默认不把它包装成密码工具。 | P3／S |
| 25. [转换为大写](../../src/pages/tools/string/uppercase/index.tsx)<br>`string/uppercase` | 原生大写转换。 | 原生 toLocaleUpperCase；IT Tools Case Converter 对标<br>[IT Tools](https://github.com/CorentinTh/it-tools)、[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 语言相关大小写与多种 case 预设可增强功能；不需要另一个完整工具站。 | 增加大小写／标题／句首／驼峰／蛇形模式，标注 locale 与不可逆变换。 | P2／S |
| 26. [提取子字符串](../../src/pages/tools/string/extract-substring/index.tsx)<br>`string/extract-substring` | 根据位置／规则提取子串。 | 字素范围选择＋原生查找；CyberChef 对标<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/)、[CyberChef](https://github.com/gchq/CyberChef) | 直接选中输入文本生成范围、展示边界比只填下标更好；没有确认到需要替换的独立轻量引擎。 | 加入选择联动、首尾规则、匹配列表和字符单位，避免混用 0／1 起始位置。 | P1／M |
| 27. [创建回文](../../src/pages/tools/string/create-palindrome/index.tsx)<br>`string/create-palindrome` | 自研构造回文。 | 原生字素算法升级；暂无已验证更强等价组件<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 主要提升是 Unicode 正确性和中心字符策略，外部大工具包收益低。 | 显示拼接规则、中心是否去重及结果长度；与回文检测共享归一化选项。 | P3／S |
| 28. [回文检测](../../src/pages/tools/string/palindrome/index.tsx)<br>`string/palindrome` | 自研回文判定。 | 原生字素与 Unicode 归一化<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 可解释的忽略大小写、空白、标点规则比简单真假更有用。 | 展示归一化后的内容和首个不匹配位置，默认不隐式丢弃字符。 | P2／S |
| 29. [文本添加引号](../../src/pages/tools/string/quote/index.tsx)<br>`string/quote` | 文本加引号。 | 原生引用／转义配置；CyberChef 对标<br>[CyberChef](https://github.com/gchq/CyberChef)、[Papa Parse](https://www.papaparse.com/docs) | 引号与转义应分开，JSON、CSV、Shell 不能使用同一规则。 | 提供明确的目标格式预设，显示双重转义提示，并复用 JSON／CSV 序列化器。 | P1／S |
| 30. [循环移位文本](../../src/pages/tools/string/rotate/index.tsx)<br>`string/rotate` | 文本循环移位。 | 原生字素／行移位算法<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 暂无可确认更强的等价轻量包；正确处理字素、负数位移及整长度取模即可。 | 滑块与位移数联动，显示分割位置，并与列表 rotate 共用操作模型。 | P3／S |
| 31. [ROT13 编码与解码](../../src/pages/tools/string/rot13/index.tsx)<br>`string/rot13` | ROT13 编码／解码。 | 保留原生 ROT13；CyberChef 作为对标<br>[CyberChef](https://github.com/gchq/CyberChef) | 核心变换成熟，替库没有明显收益；可扩展 ROT-N，但不能宣称加密保护。 | 加入偏移预设、字母范围说明与双向样例，保留一键复制。 | P3／S |
| 32. [Base64 编码与解码](../../src/pages/tools/string/base64/index.tsx)<br>`string/base64` | Buffer 编码／解码 UTF-8 文本。 | CyberChef / IT Tools；原生 TextEncoder＋字节模型<br>[CyberChef](https://github.com/gchq/CyberChef)、[IT Tools](https://github.com/CorentinTh/it-tools) | 更强方案区分文本与文件、标准 Base64 与 URL-safe、解码错误与二进制输出。 | 统一 Bytes 输入输出，补 Base64URL、填充策略及编码选择；保留兼容测试后再考虑移除 Buffer。 | P1／M |
| 33. [文本统计](../../src/pages/tools/string/statistic/index.tsx)<br>`string/statistics` | 自研字符、行、句、词及频次；字符数使用 text.length。 | Intl.Segmenter＋统计卡片；DevToys 对标<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/)、[DevToys](https://github.com/DevToys-app/DevToys.Tools) | 字素／码点／UTF-16 长度不同，中文分词和句子边界不能只依靠西文分隔符。 | 并列展示各长度定义，中文词数使用分段器，频次表支持排序及导出。 | P1／M |
| 34. [屏蔽指定文本](../../src/pages/tools/string/censor/index.tsx)<br>`string/censor` | 按词表与规则屏蔽指定文本。 | 原生可配置匹配管线；未确认需要换整套外部过滤库<br>[CyberChef](https://github.com/gchq/CyberChef) | 用户自定义规则、命中原因和中文子串行为比扩大默认敏感词库更实用。 | 提供全词／子串／正则模式、命中预览、保留长度与词表导入；执行可取消。 | P2／M |
| 35. [密码生成器](../../src/pages/tools/string/password-generator/index.tsx)<br>`string/password-generator` | 已使用 Web Crypto；支持字符类别和排除歧义字符。 | 保留 Web Crypto；IT Tools Token Generator 对标<br>[Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 不是 Math.random 实现，毋须因“安全随机”而重写；可提升批量、口令和采样策略。 | 保留密码生成器，增加批量和易记口令为独立模式；随机索引用拒绝采样降低取模偏差。 | P1／M |
| 36. [字符串 URL 编码器](../../src/pages/tools/string/url-encode/index.tsx)<br>`string/url-encode-string` | 原生 URL 编码。 | WHATWG URL / URLSearchParams；IT Tools 对标<br>[WHATWG URL](https://url.spec.whatwg.org/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 整 URL、组件编码、表单参数编码的规则不同，混用会损坏 URL。 | 增加三种明确模式，展示编码字符对照、空格策略和保留字符。 | P1／S |
| 37. [字符串 URL 解码器](../../src/pages/tools/string/url-decode/index.tsx)<br>`string/url-decode-string` | 原生 URL 解码。 | WHATWG URL / URLSearchParams；IT Tools 对标<br>[WHATWG URL](https://url.spec.whatwg.org/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 不完整百分号、非法 UTF-8、加号是否表示空格需要显式反馈。 | 增加严格／容错模式和错误位置，避免整条输入因一行错误而无结果。 | P1／S |
| 38. [URL 编辑器](../../src/pages/tools/string/url-editor/index.tsx)<br>`string/url-editor` | 已有 URL 分解与编辑界面。 | 原生 URL / URLSearchParams；IT Tools URL Parser 对标<br>[WHATWG URL](https://url.spec.whatwg.org/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 主要增益是重复参数、空值、编码视图和参数行操作；不必替换原生 URL 引擎。 | 用可增删／排序参数表保留重复键，提供相对 URL 基地址和即时有效性提示。 | P1／M |
| 39. [Unicode 编码与解码](../../src/pages/tools/string/unicode/index.tsx)<br>`string/unicode` | Unicode 编码／解码。 | Unicode 标量检查器；Intl.Segmenter＋原生编码<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/)、[CyberChef](https://github.com/gchq/CyberChef) | 码点、UTF-16 code unit、UTF-8 字节并不相同，须统一呈现。 | 按可见字符展示 U+码点、字节、转义与组合分组；支持代理对错误提示。 | P1／M |
| 40. [隐藏字符检测器](../../src/pages/tools/string/hidden-character-detector/index.tsx)<br>`string/hidden-character-detector` | 检测隐藏字符并展示处理结果。 | Unicode 属性驱动的原生检查器；CyberChef 十六进制视图对标<br>[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/)、[CyberChef](https://github.com/gchq/CyberChef) | 更强的交互是可见占位、码点位置和逐项处理，而不是一律删掉所有格式字符。 | 显示字符名称／索引／类别，分开 ZWJ、BOM、控制字符；保留 emoji 联字的可选择策略。 | P1／M |
| 41. [邮箱地址提取](../../src/pages/tools/string/email-extractor/index.tsx)<br>`string/email-extractor` | 文本邮箱匹配。 | 候选提取＋validator.js isEmail<br>[validator.js](https://github.com/validatorjs/validator.js) | validator 是校验器，不是整段文本提取器；组合可增加国际域名和规则配置。 | 保留定位提取，候选后做验证，提供去重、来源行号、无效项原因与导出。 | P1／M |
| 42. [文本差异对比](../../src/pages/tools/string/text-compare/index.tsx)<br>`string/text-compare` | diff 库生成文本差异。 | 保留 jsdiff 引擎；DevToys / CyberChef 交互对标<br>[DevToys](https://github.com/DevToys-app/DevToys.Tools)、[CyberChef](https://github.com/gchq/CyberChef) | 增益主要是行内差异、同步滚动、忽略空白、折叠相同片段，不一定更换 diff 库。 | 支持并排／统一视图、上／下一差异、行号、文件输入与大文本 worker。 | P1／M |
| 43. [URL 路径生成器](../../src/pages/tools/string/slug-generator/index.tsx)<br>`string/slug-generator` | 自研 URL slug 转换。 | 原生 Unicode slug 策略；IT Tools 对标<br>[WHATWG URL](https://url.spec.whatwg.org/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 拼音／音译与保留 Unicode 是不同产品选择；没有验证到应当强制替换为某一库。 | 提供保留中文／ASCII 模式、分隔符与大小写选项，显示归一化造成的信息变化。 | P2／S |
| 44. [bcrypt 哈希](../../src/pages/tools/string/bcrypt/index.tsx)<br>`string/bcrypt` | 已分生成／验证两个表单，使用 bcryptjs。 | 保留 bcryptjs；IT Tools bcrypt 对标<br>[bcryptjs](https://github.com/dcodeIO/bcrypt.js)、[IT Tools](https://github.com/CorentinTh/it-tools) | 现库可满足兼容哈希；需关注 UTF-8 72 字节截断、成本耗时和 worker 隔离。 | 加字节长度与截断提示，耗时任务可取消；其他哈希算法作为新工具，不能静默替换已有 bcrypt。 | P1／M |
| 45. [表格格式转换](../../src/pages/tools/string/table-text-converter/index.tsx)<br>`string/table-text-converter` | 支持多种表格文本格式；CSV 使用共享自研解析器。 | Papa Parse＋原生表格；TanStack Table 作为大型交互候选<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 更强的是跨行引用兼容、列映射和结构化预览；表格组件不能代替解析器。 | 先修复共享 CSV 内核，再支持列重命名／类型、Markdown 宽字符对齐、导出往返一致。 | P0／M |

### JSON（9 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 46. [验证 JSON](../../src/pages/tools/json/validateJson/index.tsx)<br>`json/validateJson` | JSON／JSON5 语法处理与状态反馈。 | Ajv；vanilla-jsoneditor 可选树视图<br>[Ajv](https://ajv.js.org/)、[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | Ajv 补充 JSON Schema，而非代替文本 JSON.parse；编辑器提供结构导航和错误位置。 | 保留快速语法模式，增加可粘贴 Schema、JSON Pointer 错误导航及显式 JSON5 开关。 | P1／M |
| 47. [格式化 JSON](../../src/pages/tools/json/prettify/index.tsx)<br>`json/prettify` | JSON.parse＋JSON.stringify 缩进。 | 原生快速模式＋按需 vanilla-jsoneditor<br>[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 格式化本身无须换库；树／表格视图、搜索和折叠能明显提升大型数据体验。 | 保留轻量文本入口，用户切结构视图时才加载编辑器；补大整数精度策略。 | P1／M |
| 48. [压缩 JSON](../../src/pages/tools/json/minify/index.tsx)<br>`json/minify` | 解析 JSON 后重新序列化。 | 保留原生快速模式；结构编辑器为可选项<br>[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 主要增益是压缩统计、非法位置和精度保护；换重型库对小 JSON 无收益。 | 显示节省字节，支持文件输出，明确严格 JSON／JSON5 转换边界。 | P2／S |
| 49. [字符串化 JSON](../../src/pages/tools/json/stringify/index.tsx)<br>`json/stringify` | JSON5 与字符串化选项。 | 原生字符串序列化＋显式 JSON／JSON5 模式<br>[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor)、[jsonrepair](https://github.com/josdejong/jsonrepair) | “把文本编码为 JSON 字符串”和“解析后格式化对象”必须分开，避免双重转义。 | 用示例解释输入类型；增加反向解析按钮及层数提示，不隐式修复。 | P1／S |
| 50. [JSON 转 XML](../../src/pages/tools/json/json-to-xml/index.tsx)<br>`json/json-to-xml` | 自研映射与 XML 工具函数。 | fast-xml-parser / 独立 XML builder 候选<br>[fast-xml-parser / builder](https://github.com/NaturalIntelligence/fast-xml-parser) | JSON→XML 不存在唯一无损映射，数组、属性、根节点和空值需有约定。 | 用统一序列化适配器，提供根节点、数组与属性映射和转换前后结构预览。 | P1／M |
| 51. [JSON 转 CSV](../../src/pages/tools/json/json-to-csv/index.tsx)<br>`json/json-to-csv` | 自研嵌套展开、列联合、CSV 引用。 | Papa Parse unparse＋列映射<br>[Papa Parse](https://www.papaparse.com/docs) | 现有已有 flatten 功能；候选主要替换引用／转义实现，并非删除现有展开策略。 | 保留点路径展开，增加列选择和类型策略，使用共享 CSV 写出器并提供公式转义选项。 | P1／M |
| 52. [转义 JSON](../../src/pages/tools/json/escape-json/index.tsx)<br>`json/escape-json` | JSON 转义工具。 | 原生 JSON.stringify / parse 配对<br>[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 处理一层转义与反复解码需清楚，不能用全局替换破坏正文。 | 加入转义／反转义、当前层数和错误定位；复用 stringify 模式避免重复工具内核。 | P1／S |
| 53. [比较 JSON](../../src/pages/tools/json/json-comparison/index.tsx)<br>`json/json-comparison` | 自研递归 diff；解析前用正则自动删尾逗号。 | jsondiffpatch＋原生严格解析；jsonrepair 仅显式使用<br>[jsondiffpatch](https://github.com/benjamine/jsondiffpatch)、[jsonrepair](https://github.com/josdejong/jsonrepair) | 正则会改写合法字符串内容，已复现不同 JSON 被判相同；候选还支持数组匹配及 JSON Patch。 | 先移除隐式正则修复，再增加字段路径导航、按对象 id 匹配数组及补丁导出。 | P0／M |
| 54. [JSON 排序](../../src/pages/tools/json/sort/index.tsx)<br>`json/sort` | 自研 JSON 排序。 | vanilla-jsoneditor / JSONata 按需转换<br>[vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor)、[JSONata](https://github.com/jsonata-js/jsonata) | 结构选择、按路径排序和数组对象排序比无差别递归排序更可控。 | 明确仅排序对象键／按字段排序数组；保留原数组顺序默认值，并提供差异预览。 | P1／M |

### PDF（11 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 55. [PDF 编辑器](../../src/pages/tools/pdf/editor/index.tsx)<br>`pdf/editor` | 使用 EmbedPDF React 查看／编辑 SDK。 | 升级现有 EmbedPDF 能力；BentoPDF / Stirling PDF 作工作流对标<br>[EmbedPDF Engine](https://www.embedpdf.com/docs/engine)、[BentoPDF](https://github.com/alam00000/bentopdf)、[Stirling PDF](https://docs.stirlingpdf.com/Tools/Guides/Page-Operations/) | 已经接入 SDK，优先统一文档状态与页面操作，避免再同时引入另一套完整 PDF 编辑器。 | 先核对已安装版本与最新 Page Edit API 的差异，统一打开文档、缩略图、选区、批注和导出状态。 | P1／L |
| 56. [拆分 PDF](../../src/pages/tools/pdf/split-pdf/index.tsx)<br>`pdf/split-pdf` | pdf-lib 提取页码；已能点选单文档缩略图。 | BentoPDF Multi Tool；Stirling PDF Split；保留 pdf-lib<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[Stirling PDF](https://docs.stirlingpdf.com/Tools/Guides/Page-Operations/)、[pdf-lib](https://pdf-lib.js.org/) | 现工具本质是“提取选中页”，不等于按书签／每 N 页／文件大小拆成多份。 | 保留提取模式，补每 N 页、按分组／奇偶拆分和多文件 ZIP；统一页面编排内核。 | P1／M |
| 57. [旋转 PDF](../../src/pages/tools/pdf/rotate-pdf/index.tsx)<br>`pdf/rotate-pdf` | pdf-lib 旋转；已有缩略图选择与统一角度。 | BentoPDF / PDF Arranger；EmbedPDF Page Edit 候选<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[PDF Arranger](https://github.com/pdfarranger/pdfarranger)、[EmbedPDF Engine](https://www.embedpdf.com/docs/engine) | 更强交互允许每页单独角度、批选、撤销并与合并顺序同步，而非所有选中页只能共享一次参数。 | 在统一 PDF 工作区记录每页旋转增量，预览与导出使用同一页计划。 | P1／M |
| 58. [压缩 PDF](../../src/pages/tools/pdf/compress-pdf/index.tsx)<br>`pdf/compress-pdf` | Ghostscript WASM 压缩。 | qpdf 结构优化＋Ghostscript 分级重采样；BentoPDF 压缩体验对标<br>[qpdf](https://qpdf.readthedocs.io/en/stable/cli.html)、[BentoPDF](https://github.com/alam00000/bentopdf)、[Ghostscript licensing](https://www.ghostscript.com/licensing/index.html) | qpdf 与 Ghostscript 的优化目标不同；结构优化不能承诺大幅压缩扫描图片，重采样可能有损。 | 明确无损结构优化／图片重采样两种模式，显示实测大小、是否达到预算和文本可搜索性，结果变大时返回原图。 | P1／L |
| 59. [保护 PDF](../../src/pages/tools/pdf/protect-pdf/index.tsx)<br>`pdf/protect-pdf` | Ghostscript 设置密码，只有密码及确认两项输入。 | qpdf 加密；评估维护中的 WASM 构建<br>[qpdf](https://qpdf.readthedocs.io/en/stable/cli.html)、[Ghostscript licensing](https://www.ghostscript.com/licensing/index.html) | 候选可将用户密码、所有者密码与权限配置分开；原生 CLI 不能直接当浏览器依赖。 | 先验证加密输出可用性，再评估 qpdf WASM 或可选自托管服务；密码不进 URL／日志，权限说明与实际导出一致。 | P1／L |
| 60. [合并 PDF](../../src/pages/tools/pdf/merge-pdf/index.tsx)<br>`pdf/merge-pdf` | pdf-lib 按文件顺序复制全部页面；已有文件上下移动，无子页预览。 | BentoPDF Multi Tool、PDF24 Page mode、Stirling Page Editor；PDF.js＋pdf-lib 实现路线<br>[PDF24 Merge PDF](https://tools.pdf24.org/en/merge-pdf)、[BentoPDF](https://github.com/alam00000/bentopdf)、[Stirling PDF](https://docs.stirlingpdf.com/Tools/Guides/Page-Operations/)、[PDF Arranger](https://github.com/pdfarranger/pdfarranger)、[pdf-lib](https://pdf-lib.js.org/) | 差距是文件组拖排、子 PDF 页预览、跨文件选页／重排、逐页旋转删除、撤销和书签策略；不是简单换 merge 函数。 | 最高优先实施统一 PDF 页面编排：文件模式＋页面模式；保留按钮排序；导出按 PagePlan 复制原始页面，避免渲染成图片。 | P1／L |
| 61. [PDF 转 EPUB](../../src/pages/tools/pdf/pdf-to-epub/index.tsx)<br>`pdf/pdf-to-epub` | PDF.js 抽取文本；自建 EPUB2 ZIP，按页生成章节。 | Calibre ebook-convert；复杂版面可选 PaddleOCR 预处理<br>[Calibre conversion](https://manual.calibre-ebook.com/conversion.html#pdfconversion)、[PaddleOCR PP-StructureV3](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PP-StructureV3.en.md) | 现路径缺阅读顺序、图片、表格、语义章节；Calibre 也不能保证复杂 PDF 无损重排。 | 明确“纯文本 EPUB”能力边界；补元数据、转义及 EPUB 校验；高级转换走可选本地／自托管流程，不能承诺浏览器全格式高保真。 | P1／L |
| 62. [PDF 转 PNG](../../src/pages/tools/pdf/pdf-to-png/index.tsx)<br>`pdf/pdf-to-png` | PDF.js 逐页渲染并 ZIP。 | 保留 PDF.js；BentoPDF 转换交互对标<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[pdf-lib](https://pdf-lib.js.org/) | 核心引擎已合适，增益来自页码、DPI、透明背景、大小估计和分批处理。 | 复用 PDF 工作区页选择，逐页 worker 渲染与释放，支持 PNG/JPEG、单页下载及分批导出。 | P1／M |
| 63. [PDF 表单设计](../../src/pages/tools/pdf/form-pdf/index.tsx)<br>`pdf/form-pdf` | React-PDF 预览＋pdf-lib 生成交互字段。 | EmbedPDF 表单能力 PoC；pdf-lib AcroForm 继续使用<br>[EmbedPDF Engine](https://www.embedpdf.com/docs/engine)、[pdf-lib](https://pdf-lib.js.org/) | 更强需求是编辑已有字段、类型属性、校验、对齐、Tab 顺序及预览填表，而非仅在页面加控件。 | 先统一字段模型与 PDF 预览，增加字段列表、拖动对齐、名称唯一性、必填与导出后回读验证。 | P1／L |
| 64. [将图像转换为 PDF](../../src/pages/tools/pdf/convert-to-pdf/index.tsx)<br>`pdf/convert-to-pdf` | jsPDF 将多图转成 PDF，输入可排序。 | BentoPDF / PDF24 图像转 PDF；pdf-lib 统一生成候选<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[PDF24 Merge PDF](https://tools.pdf24.org/en/merge-pdf)、[pdf-lib](https://pdf-lib.js.org/) | 可见纸张排版、边距、自动方向、多图一页与压缩策略更实用；现生成能力无需全部推翻。 | 与图片分页打印合用版面预览，增加逐页 fit/fill、A4/Letter、自适应尺寸和方向；通过功能清单评估是否移除 jsPDF。 | P1／M |
| 65. [提取 PDF 图片](../../src/pages/tools/pdf/extract-images-from-pdf/index.tsx)<br>`pdf/extract-image-from-pdf` | PDF.js 操作流提取图像，并输出文件／ZIP。 | BentoPDF 提取流程；qpdf 结构检查辅助<br>[BentoPDF](https://github.com/alam00000/bentopdf)、[qpdf](https://qpdf.readthedocs.io/en/stable/cli.html) | “导出页面截图”和“提取原始嵌入图像”不同；需要说明重编码、遮罩与重复资源处理方式。 | 展示资源图集、分辨率／位置／类型，避免静默丢弃蒙版或重复图片；高级原流提取需单独引擎 PoC。 | P1／L |

### 列表（11 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 66. [列表排序](../../src/pages/tools/list/sort/index.tsx)<br>`list/sort` | 自研字母／数字／长度排序与顺序选项。 | Intl.Collator＋共享 List 引擎；IT Tools 对标<br>[IT Tools](https://github.com/CorentinTh/it-tools)、[Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 自然排序、locale、稳定排序、空项处理和类型说明比换 lodash 更有价值。 | 增加自然数字顺序、中文 locale 和排序前后对照；分隔规则与其它列表工具一致。 | P1／M |
| 67. [移除列表项包围字符](../../src/pages/tools/list/unwrap/index.tsx)<br>`list/unwrap` | 移除每项包围字符。 | 保留原生规则；共享 List 引擎<br>[CyberChef](https://github.com/gchq/CyberChef) | 边界精确匹配与只移除一层更安全；暂无确定更强的等价轻量库。 | 显示首尾匹配规则、未命中项与多层处理次数，复用文本 quote/wrap 配置。 | P2／S |
| 68. [反转列表](../../src/pages/tools/list/reverse/index.tsx)<br>`list/reverse` | 反转列表项顺序。 | 保留原生数组操作；CyberChef 对标<br>[CyberChef](https://github.com/gchq/CyberChef) | 已有算法足够，关键是输入拆分正确、保留空项和不改变项内文本。 | 增加带序号列表预览，明确“倒序项”与“反转项内文字”的区别。 | P2／S |
| 69. [列表去重](../../src/pages/tools/list/find-unique/index.tsx)<br>`list/find-unique` | 自研去重与绝对唯一项筛选。 | 原生 Map 频次模型<br>[IT Tools](https://github.com/CorentinTh/it-tools) | 首项保序、唯一出现、重复项三种结果应清楚区分；不需另装工具框架。 | 与文本行去重共用内核，展示频次、保留首／末项和实际删除数量。 | P1／S |
| 70. [查找高频列表项](../../src/pages/tools/list/find-most-popular/index.tsx)<br>`list/find-most-popular` | 自研统计和排序输出。 | Map 频次＋原生／TanStack Table<br>[TanStack Table](https://github.com/tanstack/table) | 结构化的次数／占比／排名表比拼接文本结果更好；大结果再考虑虚拟化。 | 支持 Top N、并列名次、分母定义、空值规则和 CSV 导出，保留原文本输出。 | P1／M |
| 71. [列表分组](../../src/pages/tools/list/group/index.tsx)<br>`list/chunk` | 按数量将列表分组。 | 原生分组管线；CyberChef 配方体验对标<br>[CyberChef](https://github.com/gchq/CyberChef) | 分组数量和每组数量是两个不同目标，应有可视化结果。 | 提供“每组 N 项／分成 N 组”切换，显示尾组策略、编号及嵌套数组导出。 | P2／S |
| 72. [添加列表项包围字符](../../src/pages/tools/list/wrap/index.tsx)<br>`list/wrap` | 每项添加包围字符。 | 原生映射＋格式专用转义器<br>[Papa Parse](https://www.papaparse.com/docs)、[CyberChef](https://github.com/gchq/CyberChef) | 围上引号不等于合法的 JSON／CSV；完整格式输出应调用专门序列化器。 | 提供自定义前后缀与 JSON/CSV 预设，显示转义规则和逐项预览。 | P1／S |
| 73. [循环移位列表](../../src/pages/tools/list/rotate/index.tsx)<br>`list/rotate` | 按偏移循环移动项。 | 原生数组移位；暂无更强等价轻量组件<br>[CyberChef](https://github.com/gchq/CyberChef) | 正负位移、长度取模和当前位置比替换库更有用。 | 加首项／末项移动按钮、位置标记及负数偏移解释。 | P3／S |
| 74. [打乱列表](../../src/pages/tools/list/shuffle/index.tsx)<br>`list/shuffle` | Fisher–Yates 算法，随机源为 Math.random。 | 保留算法；Web Crypto 随机模式可选<br>[Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/) | 普通打乱不代表密码学抽签；算法正确性、可复现种子与安全随机是独立选项。 | 新增固定种子用于复现，若提供抽签模式则使用无偏采样并注明随机源，不声称可审计公平抽签。 | P2／S |
| 75. [截取列表](../../src/pages/tools/list/truncate/index.tsx)<br>`list/truncate` | 截取列表长度。 | 原生 slice／范围选择<br>[CyberChef](https://github.com/gchq/CyberChef) | 无须新增包；起始位置、末项是否包含和保留前／后 N 项需说明。 | 用编号列表选择范围，支持前 N／后 N／索引区间，输出真实保留／删除数量。 | P2／S |
| 76. [重复列表项](../../src/pages/tools/list/duplicate/index.tsx)<br>`list/duplicate` | 重复列表项或整个列表。 | 保留原生映射与展平<br>[CyberChef](https://github.com/gchq/CyberChef) | 更强交互是区分逐项重复和整组重复、显示规模；没有确认到值得引入的独立替代。 | 提供两种模式，预估总项数和字节，过大时导出文件而非渲染全文。 | P3／S |

### CSV 与 TSV（11 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 77. [将 CSV 转换为 JSON](../../src/pages/tools/csv/csv-to-json/index.tsx)<br>`csv/csv-to-json` | 独立自研逐行解析与动态类型转换。 | Papa Parse＋可选列映射表<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 引用字段内换行、引号转义、分隔符探测、错误列表、流式文件解析更成熟；不是给旧解析器加预览即可。 | 先替换解析内核；默认保留字符串，按列选择类型，保护前导零与超大整数。 | P0／M |
| 78. [将 CSV 转换为 XML](../../src/pages/tools/csv/csv-to-xml/index.tsx)<br>`csv/csv-to-xml` | 自研 CSV 读取与 XML 输出。 | Papa Parse＋fast-xml-parser / builder<br>[Papa Parse](https://www.papaparse.com/docs)、[fast-xml-parser / builder](https://github.com/NaturalIntelligence/fast-xml-parser) | CSV 正确性与 XML 字符转义是两层问题；字段名不能直接作为不受约束的 XML 标签。 | 共用 Table 数据模型，明确非法标签名、属性／子元素映射及空值处理。 | P0／M |
| 79. [将 CSV 行转换为列](../../src/pages/tools/csv/csv-rows-to-columns/index.tsx)<br>`csv/csv-rows-to-columns` | 先按换行和逗号拆分，再转置。 | Papa Parse＋共享 transpose 引擎<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 当前对带逗号／换行的引用字段会拆错；功能与另一转置入口高度重叠。 | 合并实现并保留两个原 URL，增加头行／头列保留、非矩形数据补齐与预览。 | P0／M |
| 80. [将 CSV 转换为 TSV](../../src/pages/tools/csv/csv-to-tsv/index.tsx)<br>`csv/csv-to-tsv` | 自研格式转换。 | Papa Parse parse/unparse<br>[Papa Parse](https://www.papaparse.com/docs) | 成熟解析后按 Tab 写出，可以保留引用字段和换行；简单替换分隔符无法做到。 | 显式选择引号、换行和空值策略；增加 CSV→TSV→CSV 往返样例。 | P0／S |
| 81. [交换 CSV 列](../../src/pages/tools/csv/swap-csv-columns/index.tsx)<br>`csv/swap-csv-columns` | 共享自研 splitCsv＋索引换列。 | Papa Parse＋可选择列标题的表格<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 先保证解析正确，再按列名／拖动交换，优于要求用户手数列号。 | 显示列号与列名并同步操作，支持多列重排；导出只改变列顺序。 | P0／M |
| 82. [将 CSV 转换为 YAML](../../src/pages/tools/csv/csv-to-yaml/index.tsx)<br>`csv/csv-to-yaml` | 共享 CSV 解析；YAML 直接用 key/value 字符串拼接。 | Papa Parse＋yaml<br>[Papa Parse](https://www.papaparse.com/docs)、[yaml](https://eemeli.org/yaml/) | 需正确引用冒号、井号、换行、布尔字面量和特殊键，当前拼接方式有数据语义风险。 | 用成熟 YAML writer，默认保持单元格字符串类型；支持对象数组／二维数组预览。 | P0／M |
| 83. [更改 CSV 分隔符](../../src/pages/tools/csv/change-csv-separator/index.tsx)<br>`csv/change-csv-separator` | 共享 splitCsv 后重新连接。 | Papa Parse parse/unparse<br>[Papa Parse](https://www.papaparse.com/docs) | 正确的分隔符变更须重新引用有分隔符／换行的字段；不是单纯文本替换。 | 提供输入自动探测与输出选择，显示检测结果／解析错误和实际列数。 | P0／S |
| 84. [查找不完整的 CSV 记录](../../src/pages/tools/csv/find-incomplete-csv-records/index.tsx)<br>`csv/find-incomplete-csv-records` | 根据共享解析结果检测列数不齐。 | Papa Parse errors＋表格问题定位<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 解析器错误与真实缺失单元格要分开，否则引用字段会产生假阳性。 | 输出行号、期望／实际列数、原文及修复选项；不静默填补。 | P0／M |
| 85. [转置 CSV](../../src/pages/tools/csv/transpose-csv/index.tsx)<br>`csv/transpose-csv` | 共享 CSV 解析＋矩阵转置。 | Papa Parse＋共享 transpose 引擎<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 同“CSV 行转换为列”共享算法，可减少双份配置与测试分歧。 | 保留两个导航入口作为预设，统一处理头行、空值、引号和非矩形数据。 | P0／M |
| 86. [插入 CSV 列](../../src/pages/tools/csv/insert-csv-columns/index.tsx)<br>`csv/insert-csv-columns` | 共享解析＋插列。 | Papa Parse＋列映射表格<br>[Papa Parse](https://www.papaparse.com/docs)、[TanStack Table](https://github.com/tanstack/table) | 列标题点击定位、预览新列和批量默认值更直观；解析正确性先行。 | 支持前／后插入、默认值、序列与复制列，展示变化后再导出。 | P0／M |
| 87. [TSV 转 JSON](../../src/pages/tools/csv/tsv-to-json/index.tsx)<br>`csv/tsv-to-json` | 独立 TSV 处理与类型转换。 | Papa Parse（Tab delimiter）<br>[Papa Parse](https://www.papaparse.com/docs) | Tab 文件也可能有引用字段／换行；应与 CSV→JSON 共用错误和类型策略。 | 作为 CSV→JSON 的预设入口，保留独立 URL，支持 BOM、编码和大型文件分块。 | P0／S |

### GIF 与视频（12 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 88. [更改 GIF 速度](../../src/pages/tools/video/gif/change-speed/index.tsx)<br>`gif/change-speed` | FFmpeg 处理整段 GIF。 | gifuct-js＋gifenc 轻量帧管线；Ezgif 帧编辑对标<br>[gifuct-js](https://github.com/matt-way/gifuct-js)、[gifenc](https://raw.githubusercontent.com/mattdesl/gifenc/master/README.md)、[Ezgif](https://ezgif.com/) | 逐帧时长编辑和时间轴比只设置倍速更强；gifenc 并无通用照片抖动优势，不能默认替换全部编码。 | 提供逐帧时长、循环、预览与导出大小估计；先用真实 GIF 验证 disposal／透明处理，再决定是否替换 FFmpeg。 | P1／L |
| 89. [图片转 GIF](../../src/pages/tools/video/gif/images-to-gif/index.tsx)<br>`gif/images-to-gif` | FFmpeg 将排序后的图片生成 GIF。 | gifenc；Ezgif GIF Maker 对标<br>[gifenc](https://raw.githubusercontent.com/mattdesl/gifenc/master/README.md)、[Ezgif](https://ezgif.com/) | 轻量编码器适合简单图像动画；照片序列仍需比较调色板、抖动和质量。 | 增加帧缩略图拖排、逐帧时长、统一画布／背景和循环预览；编码器按素材选择。 | P1／M |
| 90. [修剪视频](../../src/pages/tools/video/trim/index.tsx)<br>`video/trim` | FFmpeg -c copy 裁切，已有视频播放和起止秒数。 | Mediabunny＋FFmpeg 回退；LosslessCut 工作流对标<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/)、[LosslessCut](https://github.com/mifi/lossless-cut) | 关键帧附近的快速裁切和重编码的精确裁切应分开；更换 UI 不会使 stream copy 天然帧精确。 | 补缩略图时间轴、多个片段、关键帧吸附和快／准模式；浏览器 codec 支持时评估 WebCodecs。 | P1／L |
| 91. [旋转视频](../../src/pages/tools/video/rotate/index.tsx)<br>`video/rotate` | FFmpeg 转码旋转并输出 MP4。 | Mediabunny / LosslessCut；FFmpeg 保底<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[LosslessCut](https://github.com/mifi/lossless-cut) | 只改旋转元数据与烧录像素旋转成本、兼容性不同，需允许用户选择。 | 实时 CSS／Canvas 预览；支持的容器优先只改元数据，播放器不兼容时再重编码。 | P1／M |
| 92. [压缩视频](../../src/pages/tools/video/compress/index.tsx)<br>`video/compress` | FFmpeg 压缩参数与滑块。 | Mediabunny WebCodecs；FFmpeg 高兼容模式<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 可用硬件 codec 和按需读取，仍受浏览器编码器支持约束，不能承诺所有格式更快。 | 提供目标体积／质量／兼容性预设、短片段试压、耗时估计、分辨率／音轨配置和取消。 | P1／L |
| 93. [循环视频](../../src/pages/tools/video/loop/index.tsx)<br>`video/loop` | FFmpeg 按次数循环视频。 | Mediabunny 轨道拼接 PoC；保留 FFmpeg<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 循环次数与输出时长联动更实用；能否无重编码拼接取决于轨道时间戳与容器。 | 预览接缝、按次数／总时长设置、显示预计大小并共享时间轴。 | P2／M |
| 94. [翻转视频](../../src/pages/tools/video/flip/index.tsx)<br>`video/flip` | FFmpeg 翻转视频。 | 原生实时预览＋Mediabunny 变换；FFmpeg 回退<br>[Mediabunny](https://mediabunny.dev/guide/introduction) | 即时预览可避免用户必须完整转码后才知道方向；导出仍需编码能力。 | 用水平／垂直明确按钮和方向指示，预览与导出使用同一变换描述。 | P2／M |
| 95. [裁剪视频](../../src/pages/tools/video/crop-video/index.tsx)<br>`video/crop-video` | FFmpeg 根据参数裁切。 | Mediabunny / Canvas 选区；FFmpeg 输出<br>[Mediabunny](https://mediabunny.dev/guide/introduction) | 可拖动选区、比例、坐标同步和时间轴联动优于单纯填写坐标。 | 在视频画面上交互裁剪，补 16:9／9:16／1:1、宽高编码对齐与越界反馈。 | P1／L |
| 96. [更改视频速度](../../src/pages/tools/video/change-speed/index.tsx)<br>`video/change-speed` | FFmpeg 调整速度。 | Mediabunny 转换能力 PoC；FFmpeg 保底<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 视频帧时间与音频时长、音调保持需同步；不是设置 playbackRate 就完成导出。 | 增加保持音调、静音／保留音轨、输出时长、片段预览与倍速曲线的后续扩展点。 | P1／L |
| 97. [合并视频](../../src/pages/tools/video/merge-video/index.tsx)<br>`video/merge-video` | FFmpeg concat，固定 libx264/aac 重编码。 | Mediabunny / LosslessCut；FFmpeg 标准化模式<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[LosslessCut](https://github.com/mifi/lossless-cut)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 相同 codec 的片段可评估快速重封装；不同分辨率／帧率需先匹配，不能只拼接文件列表。 | 做多片段时间轴、拖排、片段裁切、分辨率／音频规范化选择和合并前检查。 | P1／L |
| 98. [视频添加音频](../../src/pages/tools/video/add-audio/index.tsx)<br>`video/add-audio` | FFmpeg 加入音轨，等待视频和音频齐全后显式执行。 | AudioMass 多轨交互＋Mediabunny 混流；FFmpeg 保底<br>[AudioMass](https://github.com/pkalogiros/AudioMass)、[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 对齐、原音与新音量、淡入淡出、循环／截断策略决定可用性。 | 增加视频／音轨双行时间轴、拖动偏移、波形、静音原音及试听，导出前显示音轨策略。 | P1／L |
| 99. [调整视频尺寸](../../src/pages/tools/video/resize/index.tsx)<br>`video/resize` | FFmpeg 缩放视频。 | Mediabunny WebCodecs 转换；FFmpeg 回退<br>[Mediabunny](https://mediabunny.dev/guide/introduction) | 更强的是社交尺寸预设、fit/fill/pad、字幕安全区与编码约束，而非仅宽高输入。 | 共享视频变换描述，锁定比例，预览裁边／留黑和实际输出尺寸。 | P1／M |

### 数字与公式（12 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 100. [数字求和](../../src/pages/tools/number/sum/index.tsx)<br>`number/sum` | 原生 Number 求和。 | decimal.js；大整数用 BigInt<br>[decimal.js](https://mikemcl.github.io/decimal.js/) | 十进制小数和超大整数需要明确精度策略；为求和引入完整 CAS 没必要。 | 增加精度模式、无效行定位、参与统计数量及可选择忽略空行。 | P1／S |
| 101. [生成数字序列](../../src/pages/tools/number/generate/index.tsx)<br>`number/generate` | 自研数字序列。 | 原生生成器＋decimal.js<br>[decimal.js](https://mikemcl.github.io/decimal.js/) | 大范围流式输出与精确步长比换通用工具站更有价值。 | 预览前后若干项、总项数和终点是否包含；巨量结果导出文件，取消长任务。 | P2／S |
| 102. [等差序列](../../src/pages/tools/number/arithmetic-sequence/index.tsx)<br>`number/arithmetic-sequence` | 自研等差序列。 | decimal.js；与数字序列共用引擎<br>[decimal.js](https://mikemcl.github.io/decimal.js/) | 小数步长累加误差、负步长和闭区间定义需统一。 | 保留首项／公差／项数语义，使用精确十进制并显示通项公式与长度。 | P1／S |
| 103. [随机端口生成器](../../src/pages/tools/number/random-port-generator/index.tsx)<br>`number/random-port-generator` | Math.random 随机端口。 | Web Crypto＋端口区间策略；IT Tools 对标<br>[Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 随机数不能验证本机端口空闲；常用／动态端口区间和去重可改善用途。 | 分开范围、排除列表、唯一性和批量；说明浏览器并未探测端口是否占用。 | P2／S |
| 104. [随机数生成器](../../src/pages/tools/number/random-number-generator/index.tsx)<br>`number/random-number-generator` | Math.random 与范围、数量等选项。 | Web Crypto 无偏采样；可复现种子模式<br>[Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/)、[decimal.js](https://mikemcl.github.io/decimal.js/) | 安全随机与模拟复现属于不同需求；大整数、唯一数量超过范围要校验。 | 增加整数／小数、含端点、允许重复、种子和随机源，禁止静默缩小输出范围。 | P1／M |
| 105. [字节单位换算](../../src/pages/tools/number/byte-converter/index.tsx)<br>`number/byte-converter` | 自研 Number 换算；已有 SI／IEC、位／字节和精度设置。 | BigInt／decimal.js 单位模型；IT Tools 对标<br>[decimal.js](https://mikemcl.github.io/decimal.js/)、[IT Tools](https://github.com/CorentinTh/it-tools) | 现有单位范围不弱；主要增益是大整数精度和 SI／IEC 并排对照，避免混淆口径。 | 保留已有单位与精度设置，补大整数、换算公式和多单位同时输出。 | P1／S |
| 106. [数字转文字](../../src/pages/tools/number/number-to-words/index.tsx)<br>`number/number-to-words` | to-words；当前入口加载 en-US 与 zh-CN。 | 评估升级现 to-words；无须全量导入所有 locale<br>[to-words](https://github.com/mastermunj/to-words) | 官方当前文档覆盖更多区域、金额／序数及大数策略；必须先核对锁定版本 API。 | 保留按 locale 分包，增加普通数／金额／序数模式、字符串大数输入与中英文样例回归。 | P2／M |
| 107. [欧姆定律](../../src/pages/tools/number/generic-calc/index.tsx)<br>`number/generic-calc/ohms-law` | 通用 nerdamer-prime＋js-quantities 求解框架。 | 专用 JS 公式＋现单位层；math.js 仅未来表达式工具评估<br>[math.js](https://github.com/josdejong/mathjs) | 只有少数已知公式时，闭式计算和明确约束能比载入通用 CAS 更轻、更易验证。 | 保留求解目标切换，加入电路示意、单位联动、零／非法值反馈和公式解释。 | P1／M |
| 108. [电缆往返电压降](../../src/pages/tools/number/generic-calc/index.tsx)<br>`number/generic-calc/cable-voltage-drop` | 同一 CAS／单位框架处理电缆往返压降。 | 专用 JS／decimal.js＋参数化线缆模型<br>[decimal.js](https://mikemcl.github.io/decimal.js/)、[math.js](https://github.com/josdejong/mathjs) | 线材、长度定义、温度与单位假设比通用求根界面更影响使用。 | 用示意图明确单程／往返，展示材料与假设、压降百分比和参数范围；公式须单独验算。 | P1／M |
| 109. [球体表面积](../../src/pages/tools/number/generic-calc/index.tsx)<br>`number/generic-calc/area-sphere` | CAS 求球表面积并换单位。 | 原生公式＋SVG 球体示意<br>[math.js](https://github.com/josdejong/mathjs) | 无需为单一几何公式使用完整 CAS；半径／直径切换与面积单位可更清楚。 | 独立紧凑表单，半径／直径联动，展示公式、量纲与可复制结果。 | P2／S |
| 110. [球体体积](../../src/pages/tools/number/generic-calc/index.tsx)<br>`number/generic-calc/volume-sphere` | CAS 求球体积并换单位。 | 原生公式＋SVG 示意<br>[math.js](https://github.com/josdejong/mathjs) | 主要增益是体积单位、一致精度和输入含义，未发现换大型 SDK 的必要。 | 与表面积共用球体模块；半径／直径切换，核对立方单位换算。 | P2／S |
| 111. [扁带张力计算](../../src/pages/tools/number/generic-calc/index.tsx)<br>`number/generic-calc/slackline-tension` | CAS／单位框架计算扁带张力。 | 专用公式工作区＋几何示意<br>[math.js](https://github.com/josdejong/mathjs) | 图示下垂量、跨度、载荷位置和假设更有助理解；更强通用数学引擎不会自动保证物理模型适用。 | 为当前模型做独立验算与范围说明，展示单位、受力示意和输入约束，不做未验证工程结论。 | P1／M |

### 时间（12 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 112. [将天数转换为小时数](../../src/pages/tools/time/convert-days-to-hours/index.tsx)<br>`time/convert-days-to-hours` | 逐行天数与小时数换算。 | 保留轻量换算；decimal.js 精确小数<br>[decimal.js](https://mikemcl.github.io/decimal.js/)、[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | “一天=24小时”的时长换算与跨夏令时日历天不同，不应混在一个模式。 | 清晰标注时长模式，数值／单位双向联动；若按日历换算则移到时区工具。 | P2／S |
| 113. [将小时转换为天](../../src/pages/tools/time/convert-hours-to-days/index.tsx)<br>`time/convert-hours-to-days` | 小时换算为天。 | 保留轻量换算；统一 Duration 模型<br>[decimal.js](https://mikemcl.github.io/decimal.js/) | 小数天与“天＋余小时”是不同输出；界面可同时展示。 | 合并时长换算内核，增加分解结果与舍入规则，保留原入口。 | P2／S |
| 114. [将秒转换为时间](../../src/pages/tools/time/convert-seconds-to-time/index.tsx)<br>`time/convert-seconds-to-time` | 自研秒到时分秒格式。 | 统一 Duration 格式器<br>[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | 超过 24 小时、负数、小数秒和单位不应被日期对象自动回绕。 | 支持长时长和小数精度，显示时间轴单位及反向转换。 | P1／S |
| 115. [将时间转换为秒](../../src/pages/tools/time/convert-time-to-seconds/index.tsx)<br>`time/convert-time-to-seconds` | 自研时间字符串转秒。 | 统一 Duration 解析器<br>[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | HH:mm:ss、mm:ss、ISO duration 语义需显式区分，避免歧义输入。 | 用格式选择、分段字段、非法行定位；与秒转时间做往返样例。 | P1／S |
| 116. [截断时钟时间](../../src/pages/tools/time/truncate-clock-time/index.tsx)<br>`time/truncate-clock-time` | 按选项截断时钟文本。 | 原生格式／精度转换工作区<br>[Day.js](https://github.com/iamkun/dayjs) | 截掉字符与向下取整到分／秒不是同一操作；无已确认更强的独立轻量包。 | 明确截断／舍入与输出格式，增加原值对照，复用时间解析层。 | P2／S |
| 117. [日期间隔计算](../../src/pages/tools/time/time-between-dates/index.tsx)<br>`time/time-between-dates` | Day.js＋时区和 duration；存在缩写到 IANA 的映射。 | 保留 Day.js；Temporal 作为日历计算 PoC<br>[Day.js](https://github.com/iamkun/dayjs)、[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | CST 等缩写有歧义；实际经过时长与日历年月日间隔必须分开。 | 直接选 IANA 时区，显示 UTC 偏移；新增时长／日历差模式，测试 DST 跨越和月末。 | P1／M |
| 118. [Cron 表达式解析](../../src/pages/tools/time/crontab-guru/index.tsx)<br>`time/crontab-guru` | cron-validator＋cronstrue 描述及预设。 | 保留 cronstrue；增加 cron-parser<br>[cron-parser](https://github.com/harrisiirak/cron-parser) | cron-parser 可给后续运行时间和时区／DST；不是只把中文描述换一个库。 | 增加未来 10 次执行日历、IANA 时区、5／6 位格式声明及字段编辑器。 | P1／M |
| 119. [检查闰年](../../src/pages/tools/time/check-leap-years/index.tsx)<br>`time/check-leap-years` | 自研闰年检测。 | 原生公历规则；无需第三方替换<br>[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | 算法已足够简单；多年份比较、范围校验和规则解释更有价值。 | 展示世纪年规则，支持区间／列表与有效范围；明确使用公历。 | P3／S |
| 120. [Unix 时间戳与日期互转](../../src/pages/tools/time/convert-unix-to-date/index.tsx)<br>`time/convert-unix-to-date` | 已有秒／毫秒、UTC／本地、日期选择器及批量折叠区。 | 保留现界面；Temporal／Day.js 增强时区<br>[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill)、[Day.js](https://github.com/iamkun/dayjs) | 上一轮基础交互已改善；新增价值是任意 IANA 时区、精度与歧义处理，而非重做已存在的按钮。 | 补时区搜索、ISO/RFC 输出与纳秒作为明确高级模式；避免 Number 表示纳秒造成精度损失。 | P1／M |
| 121. [把时间转换至十进制格式](../../src/pages/tools/time/convert-time-to-decimal/index.tsx)<br>`time/convert-time-to-decimal` | 时间与十进制格式转换。 | Duration＋decimal.js<br>[decimal.js](https://mikemcl.github.io/decimal.js/) | 十进制小时、十进制分钟和 HH.mm 不是同一种格式。 | 明确结果单位、输入格式和舍入，显示 01:30→1.5小时的解释及反向转换。 | P1／S |
| 122. [Discord 时间戳生成器](../../src/pages/tools/time/discord-timestamp/index.tsx)<br>`time/discord-timestamp` | 根据日期生成 Discord 时间戳。 | 原生 Date／Intl；保留算法<br>[Day.js](https://github.com/iamkun/dayjs) | 更强体验是全部 Discord 样式即时预览、相对时间和时区，不需专门大库。 | 提供样式卡片一键复制、日期时区和实时相对值，按格式语法验收。 | P2／S |
| 123. [日期星期计算器](../../src/pages/tools/time/date-weekday-calculator/index.tsx)<br>`time/date-weekday-calculator` | Day.js 计算星期。 | 原生 Intl / Day.js；时区增强<br>[Day.js](https://github.com/iamkun/dayjs)、[Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | 本地化星期、周起始、ISO 周与指定时区比更换现库更实用。 | 日历选择与批量输入共存，增加时区、星期编号口径和 ISO 周为可选输出。 | P2／S |

### 音频（5 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 124. [从视频中提取音频](../../src/pages/tools/audio/extract-audio/index.tsx)<br>`audio/extract-audio` | FFmpeg 从视频提取并按格式导出。 | Mediabunny 解复用；LosslessCut 轨道交互<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[LosslessCut](https://github.com/mifi/lossless-cut) | 可区分原音轨无重编码提取与重新编码格式转换，避免不必要的损失与等待。 | 显示全部音轨、语言／声道／codec；选择原始音轨或转换，支持局部区间。 | P1／M |
| 125. [更改音频速度](../../src/pages/tools/audio/change-speed/index.tsx)<br>`audio/change-speed` | FFmpeg 变速。 | AudioMass 试听；Web Audio 预览＋FFmpeg 导出<br>[AudioMass](https://github.com/pkalogiros/AudioMass)、[WaveSurfer.js](https://wavesurfer.xyz/docs/)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 实时试听、保持音调和变调是不同需求；WaveSurfer 本身不是音频变换器。 | 速度与输出时长联动，提供保持音调选项与 AB 试听，先验证倍率范围。 | P1／M |
| 126. [修剪音频](../../src/pages/tools/audio/trim/index.tsx)<br>`audio/trim` | 已有原生波形、起止秒数、滑块与播放选区；FFmpeg 导出。 | WaveSurfer Regions；AudioMass 完整编辑体验<br>[WaveSurfer.js](https://wavesurfer.xyz/docs/)、[AudioMass](https://github.com/pkalogiros/AudioMass) | 下一步价值是可缩放时间标尺、多选区、零交叉点和淡入淡出；不应忽略现有波形功能。 | 先补可缩放时间轴与多区间；只有原生实现复杂度超预算时接入 WaveSurfer，导出仍由处理引擎承担。 | P1／M |
| 127. [合并音频](../../src/pages/tools/audio/merge-audio/index.tsx)<br>`audio/merge-audio` | FFmpeg 合并文件并选择输出格式。 | AudioMass 多轨；WaveSurfer＋FFmpeg<br>[AudioMass](https://github.com/pkalogiros/AudioMass)、[WaveSurfer.js](https://wavesurfer.xyz/docs/)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 顺序拼接与同时混音不同；需要波形排列、片段时长、响度和接缝处理。 | 提供拼接／混音两种明确模式，增加交叉淡化、静音间隔、响度预览与撤销。 | P1／L |
| 128. [循环音频](../../src/pages/tools/audio/loop-audio/index.tsx)<br>`audio/loop` | FFmpeg 按次数循环音频。 | Web Audio 试听＋共享音频时间轴<br>[AudioMass](https://github.com/pkalogiros/AudioMass)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 接缝无点击声、总时长与淡化更影响体验；单项不需要另一个完整编辑器。 | 允许次数／目标时长，显示总时长与样本级循环区间，加入接缝试听。 | P2／M |

### XML 与格式转换（6 项）

| # / 工具与源码 | 当前实现 | 候选／替代路线 | 功能对比 | 具体建议 | 优先级／投入 |
| --- | --- | --- | --- | --- | --- |
| 129. [格式化 XML](../../src/pages/tools/xml/xml-beautifier/index.tsx)<br>`xml/xml-beautifier` | fast-xml-parser 验证并重建 XML。 | 评估独立 fast-xml-builder；保留当前快速模式<br>[fast-xml-parser / builder](https://github.com/NaturalIntelligence/fast-xml-parser)、[fast-xml-validator](https://github.com/NaturalIntelligence/fast-xml-validator) | 上游已将 validator／builder 分拆并推荐独立模块；混合内容、空白、CDATA 保真须单独验收。 | 先验证锁版 API 与语义保留，再做模块迁移；增加格式化差异视图，不能把全部空白当无意义。 | P1／M |
| 130. [验证 XML](../../src/pages/tools/xml/xml-validator/index.tsx)<br>`xml/xml-validator` | fast-xml-parser XMLValidator 做语法校验。 | fast-xml-validator；可选 libxml2-wasm XSD<br>[fast-xml-validator](https://github.com/NaturalIntelligence/fast-xml-validator)、[libxml2-wasm](https://github.com/jameslan/libxml2-wasm) | 语法正确与符合 XSD 是不同能力；后者是可选较重引擎。 | 优先跟进上游推荐的独立 validator；高级模式接受 XSD 并定位错误，限制外部资源解析。 | P1／M |
| 131. [音频转换器](../../src/pages/tools/converters/audio-converter/index.tsx)<br>`converters/audio-converter` | FFmpeg 音频格式转换。 | Mediabunny＋WebCodecs；FFmpeg 保留回退<br>[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 更强的是编码支持探测、音轨／采样率／声道／码率控制与批量队列；不能仅改扩展名。 | 导出前显示实际 codec、封装、预估时长／大小，优先不重编码，支持取消与失败重试。 | P1／L |
| 132. [将图像转换为 WebP](../../src/pages/tools/converters/convert-to-webp/index.tsx)<br>`converters/convert-to-webp` | Canvas toBlob＋批量 ZIP。 | jSquash WebP；Squoosh 对标<br>[jSquash](https://github.com/jamsinclair/jSquash)、[Squoosh](https://github.com/GoogleChromeLabs/squoosh) | 显式无损／有损和编码参数更可靠；Animated WebP 与静态图是不同路径。 | 新增质量／无损模式、透明度预览与对照；动画输入须保留动画或明确拒绝，不能静默首帧化。 | P1／M |
| 133. [图片转 JPG](../../src/pages/tools/converters/convert-to-jpg/index.tsx)<br>`converters/convert-to-jpg` | Canvas 转 JPG，支持背景色、HEIC 和批量 ZIP。 | jSquash JPEG；保留 Canvas 快速模式<br>[jSquash](https://github.com/jamsinclair/jSquash)、[Squoosh](https://github.com/GoogleChromeLabs/squoosh) | 增益是更丰富编码参数和质量对照；JPEG 不支持透明，背景色设置已存在。 | 保留已有背景色，增加编码模式、元数据／方向策略、目标体积和实际 MIME 验收。 | P1／M |
| 134. [视频转 GIF](../../src/pages/tools/converters/video-to-gif/index.tsx)<br>`converters/video-to-gif` | FFmpeg 生成 GIF。 | Ezgif 交互对标；Mediabunny 抽帧＋FFmpeg／gifenc 编码 PoC<br>[Ezgif](https://ezgif.com/)、[Mediabunny](https://mediabunny.dev/guide/introduction)、[ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/)、[gifenc](https://raw.githubusercontent.com/mattdesl/gifenc/master/README.md) | 选区、帧率、尺寸、调色板与大小预估更关键；gifenc 不应无验证用于所有照片／视频。 | 共享视频时间轴，先试导出短片段，显示帧数／体积；有条件提供 WebP 等替代动画输出。 | P1／L |


## 6. 建议实施路线与验收门槛

### 阶段 A：先修正确性，再增加按钮

范围：14 个标为 P0 的入口，集中修共享 CSV／TSV 内核、YAML 写出、JSON 比较和透明色处理。统一解析选项、错误行号和数据类型，不要把 14 项当成 14 个独立大项目。

验收：CSV 引用字段中的逗号、CRLF／LF、引号、内嵌换行；BOM、前导零、超大整数、空列及坏行；YAML 冒号／井号／多行值；JSON 合法字符串不被修复器改写；透明 PNG 的 alpha 与视觉一致。对输入→转换→回读做语义比较。

### 阶段 B：优先交付 PDF 页面编排

先完成第 3 节 MVP，合并、提取、旋转、删除共享 PagePlan，保留原入口与文件上下移动。并行验证当前 EmbedPDF 的页面编辑 API、表单／批注保留和打包增量，依据结果决定中长期是否统一到 SDK；不要同时维护两个完整页面工作台。

验收：真实导出页序、旋转、重复页面、书签／表单策略、密码文件、同名文件、取消与资源释放；桌面、触屏和键盘都能完成排序。PDF 合并应是本阶段首先可见的改进。

### 阶段 C：图像与结构化数据工作区

图像共享选区与变换状态，优先复用已安装裁切组件。pica／jSquash 只接入能够证明画质或参数收益的任务；无损 PNG 与有损量化分开。结构化数据共享 Table／JsonValue 模型；树编辑器和高级查询在用户需要时加载。

验收：像素／尺寸／alpha／实际 MIME、SVG 向量、动画帧时长、方向与元数据策略；CSV／JSON／XML 转换边界清楚，数值精度和空值策略不会被界面偷偷决定。

### 阶段 D：媒体时间轴与快速路径

先完善统一片段／音轨时间轴、元数据与编码能力检测，保留已有音频波形／选区操作。选取裁剪、提取音轨和同 codec 合并作为 Mediabunny PoC；通过后再扩展压缩、变换和转换。FFmpeg 继续回退，原生服务端 FFmpeg 只作可选部署能力。

验收：按支持矩阵测试 Chrome／Edge／Firefox／Safari 和手机环境；区分关键帧快切与精确切；检查 VFR、方向、音画同步、多个音轨、无音频及不匹配参数。WaveSurfer 仅解决可视化部分，不能替代导出引擎。

### 阶段 E：统一时间、精度与轻量公式

复用 Day.js；增加 cron-parser 时计入 Luxon 的额外成本，避免同时默认拉入多套日期运行时。将五个固定公式的显示、单位、假设与求解独立验证，能直接计算的从 CAS 中移出。保留原 URL，只减少内部重复实现。

验收：十进制求和／序列、超大整数、SI／IEC、负时长／超过 24 小时、DST、月末、IANA 时区和 Cron 下一次运行；国际化文本使用 emoji、组合字符、中文和重复 URL 参数做样例。

### 统一决策门槛

| 维度 | 采用前要得到的证据 |
| --- | --- |
| 功能真实性 | 至少一项比当前实现更好的可见能力，有真实输入和实际导出验证；不是只有配置面板变多 |
| 可集成性 | 明确库／完整应用／桌面／服务端类别，确认 React／Vite 与锁定版本；PoC 通过再替换 |
| 质量与正确性 | 语义／像素／页序／音轨回读正确；不会靠修复、首帧化或隐式类型转换掩盖数据丢失 |
| 性能 | 同一设备／浏览器／输入记录首屏、首次加载、处理耗时、峰值内存和输出大小；分别看冷／热缓存 |
| 可靠性 | 取消、坏文件、部分失败、资源释放、旧结果失效和重试可验证 |
| 部署与授权 | 本地／服务端边界可见；资源可固定版本和自托管；实际分发的依赖、WASM、模型等许可已核对 |

推荐先后顺序为：**正确性修复 → PDF 编排 → 表格与图像共享工作区 → 媒体时间轴／快路径 → 其余原生工具增强**。这比逐个替换 134 套第三方 UI 更符合轻量、可维护和实际功能提升的目标。

本轮是调研交付：已核对全部 134 个入口与来源映射，运行两项关键纯函数复现，并记录现有构建资产作为基线；没有把候选文档宣传当作本项目实测，也没有改动处理引擎。下一轮可以按上述阶段拆成可验收的实现任务。


## 7. 一手来源与部署边界

以下 55 项来源均以项目官网、官方仓库、官方文档或标准为主。查阅日为 2026-11-16；“最新文档存在某 API”不代表仓库当前锁定版本已有该 API。未引用星标数、排名或宣传速度作为实测结论。

| 项目／标准 | 可如何使用 | 核对要点 | 许可／部署边界 |
| --- | --- | --- | --- |
| [PDF24 Merge PDF](https://tools.pdf24.org/en/merge-pdf) | 在线产品／交互对标 | 官网列出文件拖排、Page mode、选页、书签／封面／目录选项；此在线合并页面说明文件在服务器处理。 | 产品条款；不作为可复制组件 |
| [BentoPDF](https://github.com/alam00000/bentopdf) · [补充1](https://github.com/alam00000/bentopdf/blob/main/COMMERCIAL-LICENSE.md) · [补充2](https://github.com/alam00000/bentopdf/releases/tag/v2.8.11) | 浏览器完整产品／交互与实现候选 | Multi Tool 将合并、拆分、排序、删除、旋转等放入一个工作区；README 列出本地处理与运行时 WASM 组件。 | AGPL-3.0／商业双许可；所用第三方引擎另核验 |
| [Stirling PDF](https://docs.stirlingpdf.com/Tools/Guides/Page-Operations/) · [补充1](https://github.com/Stirling-Tools/Stirling-PDF) · [补充2](https://raw.githubusercontent.com/Stirling-Tools/Stirling-PDF/main/LICENSE) | 完整应用／可选自托管服务 | 文档说明拖排合并、按名称／日期排序、目录与多种拆分方式；适合工作流对标和可选服务。 | Open-core；根 LICENSE 存在目录级例外，不能按全仓库 MIT 处理 |
| [PDF Arranger](https://github.com/pdfarranger/pdfarranger) | 桌面产品／交互对标 | 交互式合并、拆分、旋转、裁剪、页面重排；是桌面应用，不是 React 组件。 | GPL-3.0 |
| [EmbedPDF Engine](https://www.embedpdf.com/docs/engine) | 已存在的浏览器 SDK／版本对齐 PoC | 当前文档提供 Worker 中的 PDFium 派生运行时及页面旋转、重排、删除、插入、合并、拆分能力；须核对项目锁版 API。 | 按 SDK 与运行时各自 LICENSE 锁版核验 |
| [pdf-lib](https://pdf-lib.js.org/) | 已存在的浏览器文档引擎 | 纯 JavaScript 文档创建、页面复制／增删、拆分合并与 AcroForm；现有合并可直接围绕页计划扩展。 | 实施前按锁定版本核验 |
| [qpdf](https://qpdf.readthedocs.io/en/stable/cli.html) · [补充1](https://qpdf.readthedocs.io/en/stable/license.html) | 原生 CLI／WASM 构建或服务端 PoC | 支持结构变换、选页、加密与检查；原生 CLI 本身不能直接作为浏览器模块，WASM 构建须单独评估。 | Apache-2.0，WASM 包装与组件另核 |
| [Calibre conversion](https://manual.calibre-ebook.com/conversion.html#pdfconversion) | 桌面／CLI，可选自托管转换 | 以 XHTML 为中间表示的电子书转换管线，有元数据与章节等配置；PDF 版面恢复有明确限制。 | 实施前按锁定版本核验 |
| [Ghostscript licensing](https://www.ghostscript.com/licensing/index.html) | 已存在 WASM 引擎的选型约束 | 现压缩与加密链路涉及 Ghostscript，需核对实际构建、分发和授权方式。 | AGPL／商业授权 |
| [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | 浏览器完整产品／交互对标 | 适合参考编码参数、图像质量对照和体积反馈；不建议将完整应用当作单一工具的依赖。 | 实施前按锁定版本核验 |
| [iLoveIMG Resize](https://www.iloveimg.com/resize-image) | 在线产品／交互对标 | 像素与百分比、比例约束、批量尺寸的直接操作流程。 | 产品条款；仅对标交互 |
| [pica](https://raw.githubusercontent.com/nodeca/pica/master/README.md) | 浏览器重采样组件 | 提供浏览器高质量缩放、Worker／WASM 技术选择、分块内存控制；不能由文档替代本项目画质实测。 | 实施前按锁定版本核验 |
| [jSquash](https://github.com/jamsinclair/jSquash) | 浏览器／Worker 编解码模块 | 从 Squoosh 派生的模块化 WASM 图像 codecs，面向浏览器及 Worker；每种 codec 独立加载和核验许可。 | 实施前按锁定版本核验 |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | 交互式裁切组件 | 可用于可视化裁剪工作区；项目已有 react-image-crop 时应先验证能否复用，避免重复依赖。 | 实施前按锁定版本核验 |
| [Pintura](https://pqina.nl/pintura/) | 商业图像编辑 SDK／交互对标 | 集成裁剪、旋转、缩放、标注、色彩、撤销与可保存状态；是否引入取决于功能与授权预算。 | 商业 SDK，价格／条款以采购时页面为准 |
| [magick-wasm](https://github.com/dlemstra/magick-wasm) | 按需 WASM 图像引擎 | 将 ImageMagick 用于浏览器，无须图像处理 API；实际可用格式依赖构建，不能按桌面全部格式直接承诺。 | 仓库 Apache-2.0；底层组件许可另核 |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 已存在的浏览器 OCR 引擎 | 官方明确不直接支持 PDF，并指向 Scribe.js 作为扩展需求的候选；基础图片 OCR 可继续复用。 | 实施前按锁定版本核验 |
| [Scribe.js / Scribe OCR](https://github.com/scribeocr/scribe.js) · [补充1](https://github.com/scribeocr/scribeocr) | 浏览器 OCR 引擎及完整校对应用 | 图像／PDF OCR 与文本提取、可搜索 PDF；浏览器部署对资源同源有要求。 | AGPL-3.0 |
| [PaddleOCR PP-StructureV3](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/PP-StructureV3.en.md) | 可选自托管文档分析 | 版面、表格、公式等文档分析路线；需模型、运行环境与真实素材验证，不是当前前端的小组件替换。 | 实施前按锁定版本核验 |
| [IMG.LY background-removal](https://github.com/imgly/background-removal-js) | 已存在的浏览器背景移除引擎 | 浏览器／Node 背景分割，选型重点是模型素材适配、资源加载和可修改蒙版。 | AGPL-3.0／其他授权需与提供方确认 |
| [gifenc](https://raw.githubusercontent.com/mattdesl/gifenc/master/README.md) | 轻量 GIF 编码组件／有条件 PoC | 支持动画、透明和调色板；官方注明缺少抖动，更适合简单图形，不能无验证替换照片／视频 GIF 编码。 | 实施前按锁定版本核验 |
| [gifuct-js](https://github.com/matt-way/gifuct-js) | GIF 解码／帧解析组件 | 用于帧级解码与时长编辑；重新编码仍需另一编码器，并正确处理帧合成规则。 | MIT |
| [node-qrcode](https://github.com/soldair/node-qrcode) | 已存在的二维码引擎 | 浏览器与服务端 QR 生成及 PNG／SVG 等输出；现有 Wi-Fi／vCard 模板应保留。 | 实施前按锁定版本核验 |
| [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) | 可选二维码样式组件 | Logo、点阵／定位图形样式与 SVG／位图导出；需要扫描回读质量门禁。 | MIT |
| [Ezgif](https://ezgif.com/) | 在线产品／动画流程对标 | GIF、动画图像及视频到动画的操作入口与帧处理体验；不同工具的本地／服务器处理模式应单独核对。 | 产品条款；不默认外传用户文件 |
| [Mediabunny](https://mediabunny.dev/guide/introduction) · [补充1](https://github.com/Vanilagy/mediabunny/blob/main/package.json) | 浏览器媒体引擎／分阶段 PoC | TypeScript 媒体解析、重封装、转换和 WebCodecs 路线，按需读取／流式输出；可用编码受环境支持约束。 | MPL-2.0（另核扩展／codec） |
| [ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) | 已存在的浏览器兼容后备引擎 | 官方说明原生 FFmpeg 与 WASM 性能有差异；wrapper 与 core 授权不同，core 跟随 FFmpeg 及所编译外部库。 | wrapper MIT；core 与外部库分别核验 |
| [WaveSurfer.js](https://wavesurfer.xyz/docs/) | 波形／播放／选区组件 | Regions、Timeline、Envelope 等提供交互；不是负责转码、裁切导出和混音的完整处理引擎。 | 实施前按锁定版本核验 |
| [AudioMass](https://github.com/pkalogiros/AudioMass) | 完整浏览器音频编辑产品／交互对标 | 完整波形编辑和多轨、片段位置、交叉淡化等交互；不建议整体并入项目替换全部音频页面。 | 实施前按锁定版本核验 |
| [LosslessCut](https://github.com/mifi/lossless-cut) | 桌面 FFmpeg 产品／媒体流程对标 | 快速裁切、相同 codec 合并、轨道增删／提取、重封装、标记；不是浏览器嵌入组件。 | GPL-2.0 |
| [Papa Parse](https://www.papaparse.com/docs) | CSV／TSV 解析与写出组件 | 支持解析／反序列化、分隔与引用配置、错误元数据、文件分块和 Worker；可配置输出公式转义。 | 实施前按锁定版本核验 |
| [yaml](https://eemeli.org/yaml/) | 浏览器序列化组件 | YAML 1.1／1.2 的成熟 parse／stringify；用于替换拼接 YAML 文本。 | ISC |
| [vanilla-jsoneditor](https://github.com/josdejong/svelte-jsoneditor) | 可选结构化 JSON 编辑组件 | 树／表格／文本、格式化、检索／转换、Schema 与撤销；普通 ES 模块可复用依赖，standalone 可能重复打包。 | ISC |
| [Ajv](https://ajv.js.org/) | JSON Schema 校验组件 | 在语法解析之后增加 Schema 与结构错误定位；不替代 JSON 文本解析。 | 实施前按锁定版本核验 |
| [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) | 结构化差异组件 | 递归 diff、数组 LCS、delta／JSON Patch 等；对象数组语义匹配需自行指定 objectHash。 | MIT |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | 显式 JSON 修复候选 | 用于用户明确选择的修复流程；修复前后应可对比，不能作为普通解析器默默改写内容。 | 实施前按锁定版本核验 |
| [fast-xml-parser / builder](https://github.com/NaturalIntelligence/fast-xml-parser) | 已存在 XML 处理与模块升级路线 | 上游当前 README 推荐独立 validator／builder；与现锁版的 API 差异需先确认。 | 实施前按锁定版本核验 |
| [fast-xml-validator](https://github.com/NaturalIntelligence/fast-xml-validator) | XML 语法校验升级候选 | 上游拆分的校验模块；验证兼容性后迁移，不等于 XSD Schema 校验。 | 实施前按锁定版本核验 |
| [libxml2-wasm](https://github.com/jameslan/libxml2-wasm) | 按需 XSD／XML 引擎 PoC | 高级 XML／XSD 路线，WASM 资源、外部 include/import 与特性状态需实际验证。 | 实施前按锁定版本核验 |
| [TanStack Table](https://github.com/tanstack/table) | Headless 表格组件，可选而非默认 | 排序、过滤、分组、聚合和行选择，样式由项目控制；CSV 解析和虚拟滚动需要另外实现／组合。 | 实施前按锁定版本核验 |
| [JSONata](https://github.com/jsonata-js/jsonata) | 按需数据查询转换组件 | 适合统一 JSON 按路径查询、映射与转换的高级模式；不是简单格式化所必需。 | 实施前按锁定版本核验 |
| [CyberChef](https://github.com/gchq/CyberChef) · [补充1](https://raw.githubusercontent.com/gchq/CyberChef/master/src/core/config/Categories.json) | 浏览器完整工具站／步骤管线对标 | 参考操作配方、输入输出、编码与文本处理；按实际需要使用算法／模型，避免将整个项目打入首屏。 | Apache-2.0 |
| [IT Tools](https://github.com/CorentinTh/it-tools) · [补充1](https://raw.githubusercontent.com/CorentinTh/it-tools/main/LICENSE) | 完整工具站／专用表单对标 | 参考编码、case、URL、日期与生成器的任务表单；不是给 React 页面直接安装的单个组件。 | GPL-3.0 |
| [DevToys](https://github.com/DevToys-app/DevToys.Tools) · [补充1](https://raw.githubusercontent.com/DevToys-app/DevToys/main/LICENSE.md) | 桌面工具产品／文本工具体验对标 | 默认工具和专用任务操作可参考；桌面 .NET 工具不等于可嵌入 Web 组件。 | MIT |
| [Intl.Segmenter](https://tc39.es/proposal-intl-segmenter/) | 原生国际化标准／自研升级基础 | 字素、词、句分段是 Unicode 文本工具的基础；locale 大小写／Collator 属于同族 Intl／ECMAScript 能力，不由此组件一包承担。 | 原生平台能力 |
| [WHATWG URL](https://url.spec.whatwg.org/) | 原生 URL 标准 | URL 与 URLSearchParams 支撑分解、参数序列化和组件编码策略。 | 原生平台能力 |
| [Web Cryptography API](https://www.w3.org/TR/WebCryptoAPI/) | 原生随机能力 | getRandomValues 是现密码生成器已有基础；随机索引的分布与拒绝采样仍是应用层工作。 | 原生平台能力 |
| [validator.js](https://github.com/validatorjs/validator.js) | 按函数引入的校验组件 | 提供 isEmail 等配置化校验，可只导入单个函数；提取候选位置仍由本项目实现。 | 实施前按锁定版本核验 |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 已存在的兼容哈希引擎 | 官方说明输入长度限制按 UTF-8 字节计算，并提供截断检测；保留 hash 格式兼容性。 | 实施前按锁定版本核验 |
| [decimal.js](https://mikemcl.github.io/decimal.js/) | 按需十进制算术组件 | 任意精度十进制运算、精度和舍入配置；用于小数序列、求和与单位输出。 | 实施前按锁定版本核验 |
| [math.js](https://github.com/josdejong/mathjs) | 未来表达式／单位工具候选 | 表达式、数值类型、单位与部分符号计算；当前仅五个固定公式时优先评估直接公式，而非整体迁移。 | 实施前按锁定版本核验 |
| [to-words](https://github.com/mastermunj/to-words) | 现有库的升级候选 | 官方当前文档提供多 locale、金额／序数、字符串／BigInt 路线；与现安装版本 API 对齐后再启用。 | 实施前按锁定版本核验 |
| [Temporal / polyfill](https://github.com/js-temporal/temporal-polyfill) | 按需时区／日历语义 PoC | 明确区分日期时间、时区、日历与时长；不能按用户设备都已有原生 Temporal 来实现。 | 实施前按锁定版本核验 |
| [cron-parser](https://github.com/harrisiirak/cron-parser) | Cron 运行时间计算组件 | 后续运行时间、字段编辑、时区和 DST；引入 Luxon 依赖，需评估与现 Day.js 的重复。 | 实施前按锁定版本核验 |
| [Day.js](https://github.com/iamkun/dayjs) | 已存在的日期引擎 | 继续复用小型日期核心及按需插件，不为简单时长计算另引入完整时间库。 | 实施前按锁定版本核验 |
