# 墨印 MoPrint 技术说明

本文说明墨印的内部结构、打印管线、拼版与数据流，供二次开发和后续维护使用。

## 1. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│ Electron 主进程 (Node.js)                                    │
│  main.js         窗口、托盘、IPC、打印机首选项、ERP 桥         │
│  store.js        JSON 持久化（临时文件 + rename 原子写）        │
│  printer.js      打印机枚举 / 隐藏窗口 / webContents.print     │
│  receiver.js     局域网 HTTP + multipart 上传 + 手机页面        │
│  chokidar        目录监听，文件稳定后推送                       │
└───────────────┬─────────────────────────────────────────────┘
                │ contextBridge（contextIsolation，无 nodeIntegration）
┌───────────────▼─────────────────────────────────────────────┐
│ 渲染进程 (React + Vite)                                      │
│  MainApp          堆叠、价格、收款、任务、ERP 触发              │
│  QuickApp         独立快捷打印窗口                             │
│  lib/pdf.js       PDF.js 读取、页数、缩略图、页面位图           │
│  lib/print.js     页面位图 -> 打印 HTML -> 主进程打印           │
│  lib/imposition.js 长图分割、A4→A3、小册子、N-up、重复拼版      │
│  lib/label.js     标签 HTML / 二维码 / 九宫格定位              │
│  lib/erp.js       ERP 适配器接口                               │
└─────────────────────────────────────────────────────────────┘
```

设计原则：

1. **渲染进程不直接接触 Node / 文件系统**，文件读取、打印、对话框、网络服务全部走白名单 IPC。
2. **业务状态在渲染进程，持久化在主进程**，状态变化后防抖写入 `state.json`。
3. **打印内容先生成独立 HTML**，再由主进程隐藏窗口提交给系统打印驱动。
4. **手机端只负责上传**，服务端只监听局域网。

## 2. 文件进入与归堆

来源：

- 手动新建堆叠：创建真实文件夹。
- 拖拽：`webUtils.getPathForFile` 取得 Windows 路径，主进程 `stat` 返回元数据。
- 目录监听：chokidar `awaitWriteFinish`，写完稳定 1.2s 后推送。
- 手机上传：落盘到 `%APPDATA%\moprint\received\日期\`。

规则：

- 手动堆放：用户指定堆叠。
- 自动来源：同来源 10 分钟内合并到最近堆叠，超时新建。
- 全局路径去重：同一路径不重复进入多个堆叠。
- 堆叠保存 `source`、`folder`、`files[]`、`printedAt`、`frozenAmount`、`payment`、`coverage`。

## 3. PDF 与图片预览

- PDF 用 `pdfjs-dist` 解析；首页渲染为 300px 宽 JPEG 缩略图，页数写回状态。
- 图片通过 `file://` 直接给 `<img>`，不把大图转成 base64 常驻内存。
- 打印时 PDF 以 150 DPI 逐页渲染；图片等比缩放；TXT 用 Canvas 按 A4 行宽分页。
- `跳过空白页` 对 Canvas 采样，非白像素比例低于 1.2% 视为空白。
- `覆盖率` 使用同一套采样，得到页面非白像素比例，并按面积加权汇总到任务/堆叠。

## 4. 价格与打印管线

价格项目：

```
name, price, unit, color, paper, duplex, orientation, scale, printer
```

12 个快捷档位保存项目 id 的顺序，映射到当前方案。

- 单面：面数 = 页数；双面：面数 = `ceil(页数 / 2)`。
- 金额：`面数 × 单价 × 份数`；打印成功写入 `frozenAmount`，后续改价不影响历史。
- `payment`：`none / unpaid / paid`。

打印：

```
选择文件 + 档位 + 份数/页码
  -> preparePrint()
       渲染每页为 JPEG，拼装 @page HTML
  -> executePrint()
       主进程 print:html
       隐藏 BrowserWindow.loadFile(临时 HTML)
       webContents.print({
         silent, deviceName, color, copies,
         duplexMode, pageSize, landscape, margins: none
       })
  -> 成功：printed += copies，frozenAmount 累加，printedAt
  -> 失败：任务 failed，不改变订单
```

为什么位图化：统一控制页码、空白页、缩放、拼版，保证所见即所得。打印份数、颜色、单双面、纸张仍交给 Windows 打印驱动。

**打印机首选项**走独立通道：

```
preload -> ipc 'printer:preferences'
  -> resources/print-prefs.exe "<printer>"
       OpenPrinter
       DocumentProperties(DM_OUT_BUFFER, DM_IN_BUFFER, DM_PROMPT)
       ClosePrinter
```

`PrintPrefs.exe` 是随应用打包的 C# 辅助程序，源码在 `build/PrintPrefs.cs`。它通过 Windows Spooler 的 `DocumentProperties` 直接打开驱动 DEVMODE 属性页，修改的是驱动级纸张、颜色、单双面默认值。若辅助程序不可用，会回退到 `printui.dll`。

实际文档打印由随应用打包的 C# `PrintJob.exe` 完成：`PrintDocument` 设置 `DefaultPageSettings.PaperSize`、`Landscape`、`Color` 与 `PrinterSettings.Duplex`，再逐页绘制 PNG。这样 A3/A4 等纸张是驱动级设置，不会出现“选了 A3 却被驱动默认 A4 切分”的问题。Electron 的 `webContents.print` 只作为标签打印或辅助程序缺失时的回退。

**打印机能力与自动分配**：`PrintCaps.exe` 通过 `DeviceCapabilities` 和 `PrinterSettings` 读取颜色、双面、纸张列表和最大纸张。首次启动时 `assignPrintersToItems()` 给未指定打印机的项目自动匹配：黑白优先黑白机，无黑白机回退彩色机；A3 优先支持 A3 的机器；双面能力其次。用户之后可以手动改。

**收款**：右键已打印堆叠或已打印文件可“标记已付款”，写入 `payments` 并把订单改为已付款；未打印或已付款的订单不显示该操作。

## 5. 长图分割与拼版

`lib/imposition.js`：

- **长图分割**：把图片按成品宽度缩放，垂直切成 A4/A3 页，可设置重叠毫米数。
- **A4 拼到 A3**：A3 横向，两页 A4 并排，奇数补空白。
- **小册子**：按骑马钉顺序重排（4/8/12…页），A4 横向双页，建议双面长边翻转。
- **多页合一**：2/4/6/9 页网格，输出 A4 或 A3。
- **重复拼版**：同一页按行/列重复，适合标签、照片、小卡片。

所有模式都输出成品页 PNG，再由 `sheetsToHtml()` 生成打印 HTML，复用打印管线。覆盖率按成品页面积加权。

## 6. 标签

- 内容：店名、订单短号、客户、页数、时间、文件名摘要、金额、收款状态、二维码、打印机序号。
- 二维码是文本摘要，不依赖云端。
- 纸张：A4/A5/A3/自定义；九宫格位置；整体缩放。
- 标签与文档可分别选择打印机；驱动首选项同样通过 C# `PrintPrefs.exe` 的 `DocumentProperties` 打开。

## 7. 收款、统计与覆盖率

- 打印完成后 `payment = unpaid`。
- 人工「确认收款」生成 `payments` 记录，订单变 `paid`。
- 补收/退款是独立流水；退款会把订单改回待收款。
- 统计按打印完成时间过滤，金额来自冻结金额；付款流水按登记时间过滤。
- 覆盖率按页面非白像素比例计算，显示在任务、堆叠详情和拼版预览中。

## 8. 手机传输

- 默认端口 18666，占用时自动顺延。
- 随机 token，二维码 URL 为 `http://局域网IP:端口/r/<token>`。
- 手机页面内联 HTML/CSS/JS，支持选择、拍照、拖拽、上传进度。
- 服务端 busboy：12 个文件、单文件 200MB、扩展名白名单、文件名清洗。
- 上传成功后写 `received-files.json`，再发 IPC 事件；渲染进程归堆。

## 9. ERP 适配层

`src/lib/erp.js` 定义稳定接口：

```js
pushOrder(order)
pushPayment(payment)
fetchCustomer(query)
testConnection()
```

主进程提供 `erp:request`，用 `net.fetch` 发请求，避免渲染进程 CORS 限制。设置中启用并填写接口地址/令牌后，打印完成会推送订单；开启“自动同步收款”后收款/退款也会推送。未启用时完全不联网。

## 10. 持久化与恢复

- `state.json` 保存设置、价格方案、堆叠、任务、流水、快速订单。
- 写入使用 `state.json.<pid>.tmp` + `rename`。
- 退出时 `flush` 未落盘写入。
- 单实例锁保证托盘/接收服务只有一个实例。

## 11. 安装与环境

- NSIS 安装向导展示 AGPLv3，必须同意。
- 支持自定义安装目录、桌面/开始菜单快捷方式。
- `build/installer.nsh` 创建 `%APPDATA%\moprint`，在 `Sysnative` / `System32` 中探测 `spoolsv.exe`，静默尝试启动 Print Spooler；探测失败也不会弹出阻断式警告。
- Electron 自带 Chromium/Node，无需额外安装 WebView2；`PrintPrefs.exe` 使用 Windows 自带的 .NET Framework 4.x，只需系统打印后台服务正常。

## 12. 可扩展方向

1. LibreOffice headless / Office COM 转 PDF，支持 Word/Excel/PPT。
2. Windows 打印队列 WMI 监控，精确判断纸面完成/卡纸。
3. SQLite + 迁移脚本替代 JSON。
4. PWA 手机页、断点续传、多文件并发。
5. 更完整的 ERP 字段映射与会员余额。
6. 代码签名与自动更新。
