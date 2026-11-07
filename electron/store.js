'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createDefaultState, normalizeState } = require('./defaults');

let statePath = null;
let cache = null;
let writeTimer = null;
let pending = null;

function filePath() {
  if (!statePath) statePath = path.join(app.getPath('userData'), 'state.json');
  return statePath;
}

function read() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    cache = normalizeState(JSON.parse(raw));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[store] read failed', err);
    cache = createDefaultState();
    writeNow(cache);
  }
  return cache;
}

function writeNow(data) {
  const target = filePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function save(next) {
  cache = normalizeState(next);
  cache.updatedAt = Date.now();
  pending = cache;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (pending) {
      try {
        writeNow(pending);
      } catch (err) {
        console.error('[store] write failed', err);
      }
      pending = null;
    }
  }, 280);
  return cache;
}

function flush() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (pending) {
    try { writeNow(pending); } catch (err) { console.error('[store] flush failed', err); }
    pending = null;
  }
}

function dataDir(sub = '') {
  const dir = path.join(app.getPath('userData'), sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { read, save, flush, filePath, dataDir };
