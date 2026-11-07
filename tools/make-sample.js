const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0}
  body{margin:0;font-family:"Microsoft YaHei",serif;background:#fff}
  .page{width:210mm;height:297mm;padding:18mm 16mm;box-sizing:border-box;page-break-after:always;position:relative;color:#2b2b2b}
  .page:last-child{page-break-after:auto}
  h1{text-align:center;font-size:34px;letter-spacing:8px;margin:0 0 6mm;font-weight:600}
  .sub{text-align:center;font-size:14px;color:#8b5b4a;letter-spacing:4px;margin-bottom:10mm}
  .grid{border:1.5px solid #9c6654;padding:5mm;display:grid;grid-template-columns:repeat(8,1fr);gap:0;background:#fffdf8}
  .grid div{height:15mm;border:0.5px solid #d6b9a7;display:grid;place-items:center;font-size:20px;color:#3c3a36}
  .grid div:nth-child(8n+1){border-left:0}
  .grid div:nth-child(8n){border-right:0}
  .seal{position:absolute;right:22mm;bottom:32mm;width:16mm;height:16mm;border:2px solid #b34a38;color:#b34a38;display:grid;place-items:center;font-size:12px;line-height:1.2;text-align:center;border-radius:2px;transform:rotate(-6deg)}
  .foot{position:absolute;left:16mm;right:16mm;bottom:12mm;border-top:1px solid #e3d5c8;padding-top:3mm;font-size:10px;color:#a09080;display:flex;justify-content:space-between}
  .poem{font-size:18px;line-height:2.2;text-align:center;letter-spacing:3px;margin-top:12mm;color:#3a3934}
  .note{margin-top:14mm;font-size:13px;line-height:2;color:#69635c;text-align:center}
  .sign{text-align:right;margin-top:18mm;font-size:14px;color:#6f5a4d;letter-spacing:2px}
</style></head><body>
<div class="page">
  <h1>巴山城口行</h1>
  <div class="sub">硬笔书法 · 王喆</div>
  <div class="grid">
    ${Array.from({length: 64}).map((_, i) => `<div>${'巴山楚水凄凉地二十三年弃置身怀旧空吟闻笛赋到乡翻似烂柯人沉舟侧畔千帆过病树前头万木春今日听君歌一曲暂凭杯酒长精神'[i % 48]}</div>`).join('')}
  </div>
  <div class="note">录刘禹锡《酬乐天扬州初逢席上见赠》<br>硬笔组 · 巴山城口行</div>
  <div class="seal">王喆<br>印</div>
  <div class="foot"><span>墨印 · 示例文档</span><span>第 1 页 / 共 2 页</span></div>
</div>
<div class="page">
  <h1>示例说明</h1>
  <div class="sub">本地文件打印工作流</div>
  <div class="poem">自动读取　·　堆叠整理<br>快捷档位　·　系统打印<br>取件标签　·　收款统计</div>
  <div class="note">这是墨印生成的示例 PDF。<br>它演示了多页 PDF 的缩略图、页数读取、双面打印与标签打印。<br><br>把文件拖进右侧档位，即可按对应价格直接打印。</div>
  <div class="sign">墨印<br>${new Date().toLocaleDateString('zh-CN')}</div>
  <div class="seal">示例<br>文档</div>
  <div class="foot"><span>墨印 · 示例文档</span><span>第 2 页 / 共 2 页</span></div>
</div>
</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 1200 });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 600));
  const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
  const out = path.join(__dirname, '..', 'samples');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, '硬笔组 王喆 巴山城口行.pdf'), pdf);
  console.log('sample pdf written', pdf.length);
  app.quit();
});
