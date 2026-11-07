'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const cscCandidates = [
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
];
const csc = cscCandidates.find((p) => fs.existsSync(p));
const jobs = [
  { source: 'PrintPrefs.cs', out: 'MoPrint.PrintPrefs.exe', target: 'winexe', refs: ['System.Windows.Forms.dll'] },
  { source: 'PrintCaps.cs', out: 'MoPrint.PrintCaps.exe', target: 'exe', refs: ['System.Drawing.dll', 'System.Web.Extensions.dll'] },
  { source: 'PrintJob.cs', out: 'MoPrint.PrintJob.exe', target: 'exe', refs: ['System.Drawing.dll', 'System.Web.Extensions.dll'] },
];

if (!csc) {
  console.log('[csharp] csc.exe not found; using the committed helper binaries if present.');
  const missing = jobs.filter((j) => !fs.existsSync(path.join(root, 'build', j.out)));
  process.exit(missing.length ? 1 : 0);
}

for (const job of jobs) {
  const source = path.join(root, 'build', job.source);
  const out = path.join(root, 'build', job.out);
  if (!fs.existsSync(source)) {
    console.error('[csharp] source missing:', source);
    process.exit(1);
  }
  const args = [
    '/nologo',
    `/target:${job.target}`,
    '/platform:x64',
    '/optimize+',
    ...job.refs.map((r) => `/reference:${r}`),
    `/out:${out}`,
    source,
  ];
  const result = spawnSync(csc, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) {
    console.error('[csharp]', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('[csharp] compiler exited with', result.status, 'for', job.source);
    process.exit(result.status || 1);
  }
  console.log('[csharp] built', out);
}
