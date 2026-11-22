# 墨印 MoPrint

**免费、开源、本地优先的打印工作台。**  
墨印由 **allen-zhe** 维护，遵循 **AGPL-3.0-or-later**，面向打印店、自助打印和日常文件打印场景。

## 功能

- **文件堆叠**：手动新建、拖拽导入、目录监听、按时间窗口自动归堆。
- **12 个快捷档位**：A4/A3、黑白/彩色、单面/双面短翻/长翻，拖入文件即可打印。
- **PDF / 图片 / 文本**：PDF 页数、缩略图、页码范围、跳过空白页；JPG/PNG/WEBP/BMP/GIF/TIFF；TXT 自动分页。
- **Word / Excel / PPT**：支持 `.doc/.docx/.rtf`、`.xls/.xlsx/.csv`、`.ppt/.pptx`，先转 PDF 再按现有管线渲染打印；自动选择 Microsoft Office 或 WPS，最后回退 LibreOffice。
- **长图分割**：把一张超长图片按 A4/A3 切成多页，可设置页间重叠。
- **文件拼版**：A4 拼到 A3（自动识别横竖）、小册子、多页合一（2/4/6/9 页，方向随成品纸张）、重复拼版。
- **打印设置**：价格方案、单价、颜色、纸张、单双面、方向、打印机分配、导入/导出、批量编辑、Excel 式列宽调节。
- **打印机能力与自动分配**：首次启动读取每台打印机的彩色/黑白、双面、最大纸张和可用纸张，自动把打印项目分配给匹配的打印机；黑白优先黑白机，无黑白机回退彩色机，A3 优先 A3 机器。打印前校验不支持的颜色/纸张/双面。
- **纸张真实生效**：文档打印由 C# `PrintJob.exe` 设置驱动级纸张/颜色/双面，A3 档位不会再被驱动默认的 A4 覆盖或切分。
- **混合横竖版**：同一堆叠中竖版照片和横版 PDF 混合时，逐页判断方向并逐页切换 A4 横向/纵向，横版 PDF 保持横向，不再被压到竖版。
- **文件目录监听**：标题栏「监听文件夹」或设置里选择文件夹后，新出现的 PDF/图片自动进入「自动整理」堆叠；可随时暂停/恢复。
- **合并打印开关**：堆叠详情可按当前选择决定「合并成一个任务」还是「按文件顺序逐个发送」；含 PDF 默认逐文件，纯图片默认合并。奇数页 PDF + 偶数页 PDF 全选打印时不会被拼在一起。
- **照片纸**：支持 5寸/6寸/7寸/8寸（以及 A4/A3/A5/Letter），照片按 300/600 DPI 渲染，可配合「铺满纸张」做无边距照片。
- **PDF 检查机**：新增应用内虚拟打印机「墨印 PDF 检查机」，支持 A3/A4、黑白/彩色；选中后输出 PDF 到任意位置，先检查排版再出纸。
- **高清 PDF**：PDF 以 300 DPI（可选 150/600）渲染为无损 PNG 页面，避免旧版 JPEG 二次压缩；实际矢量透传能力取决于打印机驱动。
- **打印机首选项**：C# `PrintPrefs.exe` 通过 `DocumentProperties`/DEVMODE 打开驱动设置界面，**会带入当前打印项的纸张/双面/彩色**；确认后完整 DEVMODE 存到打印项，打印时用 `SetHdevmode` 生效。
- **取件标签**：二维码、订单号、客户、页数、金额、收款状态、打印机序号、纸张/九宫格位置/缩放。
- **覆盖率估算**：按页面非白像素比例估算墨粉/墨水覆盖率，显示在打印任务与堆叠详情中。
- **收款统计**：今天/昨天/近 7 天/本月/自定义日期，收款、补收、退款流水。
- **手机传输**：电脑开启局域网服务，手机扫码上传；文件不经过互联网。
- **ERP 预留接口**：标准订单/流水/客户适配器，配置后可推送，不启用时完全不联网。
- **桌面体验**：无边框窗口、托盘、窗口置顶、独立快捷打印窗口、撤销/重做、自动保存。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面容器 | Electron 33（Chromium + Node.js） |
| 前端 | React 18 + Vite 5，原生 CSS |
| PDF | PDF.js，页面位图化后排版打印 |
| 打印 | C# `PrintJob.exe`（DEVMODE、逐页方向、双面、颜色）+ Chromium 打印回退；首选项由 C# `PrintPrefs.exe` 打开并保存 DEVMODE |
| Office | C# `OfficeConv.exe` 调 Microsoft Office / WPS 的 COM 接口，或 LibreOffice 无头转换 → PDF |
| 文件监听 | chokidar |
| 手机传输 | Node HTTP + busboy，手机端为内联响应式页面 |
| 二维码 | qrcode |
| 数据 | 本机 JSON，原子写入 `%APPDATA%\moprint\state.json` |

## 开发

要求：Windows 10/11，Node.js 20 或 22。

```powershell
npm install
npm run start        # 构建前端并启动 Electron
npm run build        # 只构建前端
npm run dist:dir     # 生成 release/win-unpacked
npm run dist         # 生成安装版 + 便携版
```

`npm run dist` 的流程：

1. 构建前端；
2. 打包 `release/win-unpacked`；
3. `tools/stamp.js` 写入版本信息和图标；
4. 用已打包目录生成 NSIS 安装版与便携版。

## 检查打印（PDF 检查机）

在打印设置、堆叠详情或快捷档位里把打印机选为 **「墨印 PDF 检查机」**，点击打印后会弹出保存对话框，可保存到任意目录。它支持 A3/A4、黑白/彩色配置，并按每一页的实际方向生成 PDF，适合在不耗纸的情况下检查横竖版混排、拼版和边距。

## Word / Excel / PowerPoint

把 `.doc/.docx/.rtf`、`.xls/.xlsx/.xlsm/.csv`、`.ppt/.pptx/.pptm` 拖进堆叠即可：程序先转成 PDF 并缓存，之后与普通 PDF 一样渲染、预览、拼版、打印。

- 转换顺序：Microsoft Office → WPS → LibreOffice；可在「设置 → 启动设置 → Office 转换引擎」固定为仅 Office 或仅 WPS。
- 首次导入时完成转换并统计页数，结果缓存到 `%APPDATA%\moprint\office-cache`，同一文件只转一次。
- 兼容性最好的是 Office；WPS 走它的 Office 兼容接口；LibreOffice 对复杂排版可能有细微差异。

## 安装版

安装包位于 `release/墨印-1.1.4-安装版.exe`：

- 显示 AGPLv3 许可页，必须同意后才能继续；
- 可自由选择安装目录；
- 创建桌面与开始菜单快捷方式；
- 安装时静默尝试启动 Windows 打印后台服务并创建 `%APPDATA%\moprint` 数据目录；
- Electron 自带 Chromium/Node 运行时，无需额外安装 WebView2 或 .NET。

便携版：`release/墨印-1.1.4-便携版.exe`，双击运行。

## 手机传输

1. 点击顶部「手机传输」；
2. 手机连接同一 Wi-Fi，扫描二维码；
3. 选择 PDF/图片，文件自动进入电脑堆叠。

端口默认 18666，被占用时自动顺延。接收服务只在局域网监听，文件不会上传互联网。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Q` | 显示主窗口 |
| `P` | 打印当前堆叠 |
| `Ctrl + W` | 关闭当前堆叠并打印标签 |
| `Ctrl + E` | 关闭当前堆叠且不打标签 |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Alt + Z` | 重做 |
| `Esc` | 关闭弹窗 / 打印队列 |

## 项目结构

```text
electron/
  main.js       窗口、托盘、IPC、打印、打印机首选项、ERP 桥
  preload.js    安全 API
  printer.js    打印机枚举、C# 首选项/打印桥、隐藏窗口回退
  office.js     Office → PDF 转换编排（Office / WPS / LibreOffice）
  receiver.js   局域网接收与手机页面
  store.js      JSON 原子持久化
  defaults.js   默认价格方案和设置
src/
  MainApp.jsx   主工作台状态与打印流程
  QuickApp.jsx  独立快捷打印窗口
  components/   堆叠、详情、打印设置、标签、统计、拼版等
  lib/          PDF、打印 HTML、拼版、标签、ERP、覆盖率
build/
  PrintPrefs.cs  C# 打印机驱动首选项（DocumentProperties/DEVMODE）
  PrintCaps.cs   C# 打印机能力（DeviceCapabilities/PrinterSettings）
  PrintJob.cs    C# 文档打印（PaperSize/Color/Duplex/DEVMODE）
  OfficeConv.cs  C# Office/WPS COM 转 PDF
build/
  icon.svg      橙色品牌图标
  license.txt   AGPLv3（安装许可页）
  installer.nsh 安装环境检查
docs/
  technical-notes.md
```

## 开源协议

本项目采用 **GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）**。你可以自由使用、修改、分发；分发修改版或作为网络服务提供时，需保留同样的自由，并提供对应源码。

完整协议见 [LICENSE](LICENSE)。安装包会在安装向导中展示同一份协议并要求同意。

## 反馈与后续

- 项目主页：`https://github.com/allen-zhe/MoYin`
- 问题反馈：`https://github.com/allen-zhe/MoYin/issues/new/choose`

使用中遇到问题，欢迎附上「系统版本 / 打印机型号 / 操作步骤 / 报错截图」提 Issue；功能建议也走同一个入口。

## 已知边界

- **Office 转换依赖本机套件**：Word/Excel/PPT 需要安装 Microsoft Office 或 WPS；两者都没有时可用 LibreOffice。转换顺序为 Office → WPS → LibreOffice，也可在设置里固定引擎。
- **Excel 按整本工作簿导出 PDF**：多工作表、打印区域、分页符以 Excel/WPS 自身的打印设置为准；没设打印区域的宽表可能被缩到一页或按默认分页。
- **PPT 幻灯片是固定尺寸**：16:9 转出约 13.33×7.5 英寸，选「适合可打印区域」会留白，选「铺满纸张」会裁掉边缘。
- 实际打印质量、双面翻转、纸盒来源由 Windows 驱动决定；驱动不支持的纸张/双面会在打印前校验时提示。
- PDF 按 300/600 DPI 位图化后打印，不做矢量透传；很小的字号建议用 600 DPI。
- 手机传输使用随机连接码，不做账号鉴权，请只在可信 Wi-Fi 使用。
- ERP 接口默认关闭；未配置时不会发起网络请求。
- 便携版未做代码签名，Windows 首次运行可能出现 SmartScreen 提示。





