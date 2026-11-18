import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-zh-test-'));
function run(command, expected = 0) {
  const result = spawnSync(process.execPath, [path.join(source, 'install.mjs'), command, '--patch-dir', temporary], { encoding: 'utf8' });
  assert.equal(result.status, expected, result.stderr);
}
try {
  fs.mkdirSync(path.join(temporary, 'core'));
  fs.mkdirSync(path.join(temporary, 'user'));
  fs.writeFileSync(path.join(temporary, 'core/daemon.mjs'), '// test fixture only\n');
  fs.writeFileSync(path.join(temporary, 'user/config.json'), '{"modules":{"i18n":true,"customJs":true}}');
  const dictFile = path.join(temporary, 'user/i18n.override.json');
  const customFile = path.join(temporary, 'user/custom.js');
  const original = '\uFEFF{"_comment":"保留元数据","exact":{"Mine":"我的词条"}}\r\n';
  fs.writeFileSync(dictFile, original);
  fs.writeFileSync(customFile, '// my existing customization\r\n');
  run('install');
  const installedDict = fs.readFileSync(dictFile, 'utf8');
  assert.equal(JSON.parse(installedDict)._comment, '保留元数据');
  assert.equal(JSON.parse(installedDict).exact.Mine, '我的词条');
  assert.equal(JSON.parse(installedDict).exact['Search Across Conversations'], '搜索全部对话');
  const installedCode = fs.readFileSync(customFile, 'utf8');
  assert(installedCode.startsWith('// my existing customization\r\n'));
  new Function('ctx', installedCode);
  run('install');
  assert.equal(fs.readFileSync(customFile, 'utf8'), installedCode, 'Repeated install duplicated the hook');
  fs.appendFileSync(customFile, '\n// user changed this later');
  run('uninstall', 1);
  assert(fs.readFileSync(customFile, 'utf8').endsWith('// user changed this later'), 'Uninstall overwrote user edits');
  fs.writeFileSync(customFile, installedCode);
  run('uninstall');
  assert.equal(fs.readFileSync(dictFile, 'utf8'), original, 'Uninstall did not restore original bytes');
  assert.equal(fs.readFileSync(customFile, 'utf8'), '// my existing customization\r\n');
  assert(!fs.existsSync(path.join(temporary, 'zh-cn-addon-install.json')));
  fs.writeFileSync(dictFile, '{not JSON');
  run('install', 1);
  assert.equal(fs.readFileSync(customFile, 'utf8'), '// my existing customization\r\n', 'Invalid input changed another file');
  console.log('PASS: merge, metadata, BOM/CRLF, repeat install, edit protection, uninstall and invalid input.');
} finally {
  assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep + 'antigravity-zh-test-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
