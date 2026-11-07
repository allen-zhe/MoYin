const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0;font-family:"Microsoft YaHei"}.page{width:210mm;height:297mm;box-sizing:border-box;padding:20mm;page-break-after:always}.page:last-child{page-break-after:auto}h1{font-size:30px}</style></head><body><div class="page"><h1>空白页测试 · 第 1 页</h1><p>这一页有内容。</p></div><div class="page"></div></body></html>`;
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 500));
  const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
  const out = path.join(__dirname, '..', 'samples', '空白页测试.pdf');
  fs.writeFileSync(out, pdf);
  console.log('written', out, pdf.length);
  app.quit();
});
