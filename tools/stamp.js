'use strict';

const path = require('path');
const fs = require('fs');

(async () => {
  const { rcedit } = await import('rcedit');
  const root = path.join(__dirname, '..');
  const targets = [
    path.join(root, 'release', 'win-unpacked', '墨印.exe'),
  ];
  const icon = path.join(root, 'build', 'icon.ico');
  for (const exe of targets) {
    if (!fs.existsSync(exe)) {
      console.log('skip', exe);
      continue;
    }
    await rcedit(exe, {
      icon,
      'file-version': '0.9.8.0',
      'product-version': '0.9.8.0',
      'version-string': {
        CompanyName: 'allen-zhe',
        FileDescription: '墨印 MoPrint',
        ProductName: '墨印 MoPrint',
        LegalCopyright: 'Copyright © 2026 allen-zhe. AGPL-3.0-or-later.',
        InternalName: 'MoPrint',
        OriginalFilename: '墨印.exe',
      },
    });
    console.log('stamped', exe);
  }
})().catch((err) => { console.error(err); process.exit(1); });
