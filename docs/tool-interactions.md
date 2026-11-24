# 工具页面交互与参考

分类和执行方式由 `src/tools/catalog.ts` 管理。每条路由的布局、输入类型、常用参数、示例占位及操作名称由 `src/tools/experiences.ts` 指定。单元测试检查每个工具都有对应的页面配置。

## 参考项目与落实方式

| 参考 | 参考的交互 | 在 XFTools 中的实现 |
| --- | --- | --- |
| [iLoveIMG Resize](https://www.iloveimg.com/resize-image)、[ResizePixel](https://www.resizepixel.com/resize-image/) | 像素与百分比两种模式、宽高比、批量尺寸 | 专用缩放工作区，左侧预览、右侧尺寸；宽高联动；每张图片显示原始和目标尺寸 |
| [Squoosh](https://squoosh.app/)、[项目说明](https://github.com/GoogleChromeLabs/squoosh) | 文件导入、图像预览、参数调整和结果对照 | 上传前采用紧凑空状态；缩放后可切换原图与结果；显示文件大小；处理后再出现下载操作 |
| [CyberChef](https://gchq.github.io/CyberChef/) | 输入输出并排、及时反馈、处理参数靠近任务 | 文本、代码和结构化数据工具以双栏为主；常用选项在编辑区上方；说明与示例默认折叠 |
| [IT Tools](https://github.com/CorentinTh/it-tools) | 按工具用途使用表单 | 短数值使用两行输入 |
| [PDF24 Merge](https://tools.pdf24.org/en/merge-pdf)、[PDF24 Split](https://tools.pdf24.org/en/split-pdf) | 文件排序、页面选择、处理与导出 | 同一个 PDF 编辑器支持连续预览、文件和页面排序、缩略图选页和按范围拆分；主预览按视口渲染，侧栏每组最多显示 24 张页面缩略图 |
| [Audacity](https://manual.audacityteam.org/man/audacity_tracks_and_clips.html)、[AudioMass](https://github.com/pkalogiros/AudioMass/blob/production/src/about.html) | 波形选区、片段分割和排序、试听后调整效果 | 音频编辑器提供剪辑轨和混音轨，支持拖选区间、选区试听、片段参数和导出前编辑 |
| [格式工厂](https://www.freetime.tech/formatfactory/feature.php?language=en) | 按素材分类、选择输出格式与预设、批量运行任务 | 文件转换器将视频、音频、图片和 PDF 加入同一队列，每项保存自己的输出设置，支持逐项重试和 ZIP 下载 |
| [EpochConverter](https://www.epochconverter.com/) | 时间戳和日期双向转换、秒与毫秒区分 | Unix 工具提供日期时间选择器、单位与时区选择、当前时间快捷操作和可复制的多格式结果；原批量功能保留在折叠区 |
| [小米计算器](https://play.google.com/store/apps/details?hl=zh&id=com.miui.calculator)、[Windows 计算器](https://github.com/microsoft/calculator) | 在一个入口切换四则运算、日期差、年龄、日期推算和单位换算 | 计算器提供键盘输入、记忆和历史，可在同一页切换日历计算、时长计算和现有时间工具 |

这里参考的是交互方式，未引入这些项目的 UI 框架或外部处理服务。继续使用 [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 的渐进展示、可见标签和拖动替代操作建议，沿用已有 `design-system/xftools/MASTER.md`。

### PDF 保存验证

工作台用页面实例绑定批注与新建字段。导出写入原生 PDF 便签、区域高亮、手绘、文本批注和 AcroForm。复制页使用独立的批注字典和编号。单一来源整份导出可保留原始字段，跨文档拼接和提取会固定来源表单的外观，工作台新建字段继续可编辑。已有批注与表单可在高级编辑器中打开并应用到工作台。

格式转换、压缩和加密使用当前页序与编辑结果。PDF 压缩的无损模式仅重打包文档结构。图片压缩模式逐张处理兼容的 JPEG 与 Flate 图像，可调整最长边、质量和灰度，透明蒙版及特殊色彩空间保留原样。自动模式在 JPEG 和无损编码之间选择，JPEG 2000 由按需加载的 OpenJPEG 编码。如果结果更大，下载原文件内容。密码保护使用本地 PDFium WASM，通过单独的 Worker 处理，并在等待超时或取消后释放资源。加密文档可用有编辑权限的密码重新导入。EPUB 取自可选文字，扫描件需要先做 OCR。

## 页面行为

- 图片格式转换和图片压缩在切换模式时保留已导入的图片。预览可在原图与结果间切换，支持单张下载和批量 ZIP。格式转换按输出格式显示画质和透明设置，PNG 专用压缩显示保色程度、目标体积和抖动选项。
- PDF 格式导出在同一个页面切换 PNG 和 EPUB。PNG 支持点选页面、设置渲染倍率和批量下载，EPUB 提取文档中的可选文字。
- 格式转换任务在浏览器内顺序执行。停止转换会取消当前任务，保留队列中的结果和待办项。视频及音频通过 Worker 读取本地文件，PDF 按页渲染。单输入文件最多 150 MB，GIF 输出最多 90 秒，ZIP 内文件总量最多 160 MB。PDF 文本和 EPUB 使用已有文本层。
- 视频编辑器将素材、项目预览、参数和时间线放在同一页。主轨可混排视频、GIF 和静态图片，静态图片的停留时长可以批量应用。时间线支持截取、分割、重排和复制，配乐轨支持混音、替换原声和循环。手机端通过设置抽屉调整片段。MP4、GIF 和音频导出使用当前编辑结果，FFmpeg 在首次导出时从同站点加载，素材在浏览器内处理。
- 剪辑模板提供 16:9 横屏、9:16 竖屏、1:1 方形视频、4:5 竖版图文、1:1 方形动图和原始比例。套用模板会设置预览和导出的共同画布，以及新导入静态图片的默认停留时长。可以选择保留完整画面或居中裁切铺满。模板变更可撤销，已编辑的片段继续可编辑。
- 从「模板 → 导入剪映草稿」选择可直接读取的 `draft_content.json`、`template.json` 或明文备份，再选择本地音视频和图片。同名素材可自动关联，其他素材可手动选取。导入映射主视频轨和一段配乐，保留画布、支持的帧率、片段区间、固定倍速、音量和直角旋转／翻转。时轴间隙以空白片段保留。导入前会提示未映射的叠加轨、字幕、转场和特效，导入操作可撤销。参照 [pyJianYingDraft](https://github.com/GuanYixuan/pyJianYingDraft) 和 [Jianying-CapCut2XML 的草稿转换说明](https://github.com/Ersiter/Jianying-CapCut2XML#readme)。
- 视频预览按解码帧绘制，播放头和拖动预览合并更新。GIF 在 Worker 中解码，切换素材时释放帧和 Worker。支持 Web Locks 的浏览器会让同站点的多个视频导出排队，排队和导出均可取消。导出从本地文件按需读取，GIF 分两遍生成色板和编码。浏览器接近成片大小上限时会提示缩短片段或调整编码设置。参考 [MasterSelects 预览代理说明](https://github.com/Sportinger/MasterSelects/blob/master/docs/Features/Proxy-System.md) 和 [Emscripten 文件系统说明](https://emscripten.org/docs/api_reference/Filesystem-API.html#file-systems)。
- 时间线工具栏提供撤销和重做。`Ctrl/⌘ + Z` 撤销，`Ctrl/⌘ + Shift + Z` 或 `Ctrl + Y` 重做，空格播放或暂停，`S` 分割，`Ctrl/⌘ + D` 直接复制片段，也可用 `Ctrl/⌘ + C` 和 `Ctrl/⌘ + V` 复制粘贴。`Delete` 或 `Backspace` 删除片段。左右方向键以 1/30 秒为步长定位，按住 `Shift` 跳一秒，`Home` 和 `End` 跳到开头和末尾。文本输入和表单控件保留自身的键盘操作。
- 计算器通过 `/time/calculator` 进入，旧工具地址直达各自模式。日期推算遇到月底时取目标月最后一天，平年的闰日生日按 2 月 28 日计算。工作日包含首尾，按周休和手动排除日期统计。时长换算支持单项和逐行批量输入，结果与输入逐行对齐。

- 图片编辑器的「画布扩展」支持自定像素宽高、调整前景比例和九宫格位置。新增区域可透明、填纯色或使用原图模糊背景。与其他图片编辑共享预览、撤销和导出。 [Photoshop 画布大小说明](https://helpx.adobe.com/photoshop/desktop/crop-resize-transform/resize-adjust-resolution/change-the-canvas-size.html)

- 公共页头集中展示标题、摘要和常用操作。文件编辑器有独立工具栏，手机允许操作组换行。PDF 编辑区自适应剩余视口。 [紧凑布局](compact-tool-workspaces.md)

- 图片缩放：导入区按内容确定高度，不渲染空结果面板；预览桌面最高 370px、手机 235px。宽度和高度都可作为锁定比例的基准；批量图片分别保留各自的比例，支持单张下载与 ZIP 下载。
- 文本输入和输出并排。短数值和时间表达式采用紧凑输入。
- 参数：常用选项直接展示，其他选项进入“高级选项”；说明放在可点击的帮助中，不使用长段说明充当输入框标题。示例可一键载入，文件类示例只改变预设，保留已导入文件。
- 页头仅显示简短用途说明，避免手机端被长段工具介绍占满；完整说明保留在使用说明中。
- 文件处理：未上传时隐藏结果面板，处理按钮显示实际操作名；修改文件或参数后，旧结果失效，必须重新处理才能下载，避免保存过期结果。
- PDF：点选页面和输入页码同步；“全选”“清空”有可见按钮，空选区不能提交。分页加载缩略图，避免大文档一次渲染全部页面。
- PDF 合并：文件／页面两种编排方式，文件卡片可拖排与按钮排序；页面支持多选、Shift 连选、跨文件移动、旋转、复制、删除和空白页，提供撤销／重做及放大预览。输出前显示实际页数和来源书签选项。
- 音频编辑器拖动波形即可选区，支持秒数定位、选区试听、保留或删除剪辑轨选区、分割、复制和循环。混音轨可单独设置偏移、增益、淡入淡出和速度。空格播放，`S` 分割，`Delete` 删除，`Ctrl/⌘ + Z` 撤销。手机使用参数抽屉。导出支持 MP3、AAC、WAV、FLAC、OGG；引擎按需加载，并从本地文件按需读取。为控制内存，超过 24 MB 或 8 分钟的素材跳过波形分析，浏览器支持的素材仍可试听。
- 日期：秒和毫秒切换保留同一时刻，UTC 与本地时区明确区分；无效输入清空结果并显示错误。

## 验证范围

浏览器测试检查全部工具路由在 1440px 与 375px 下的加载、运行时错误和横向溢出。其他验证包括缩放实际 PNG 尺寸、混合比例批量 ZIP、PDF 实际提取页数、参数修改后结果失效、波形与裁剪控制、时间戳双向转换和简体中文界面。

大型视频转码和 HEIC/GIF 编码组合仍需使用相应文件验证。
