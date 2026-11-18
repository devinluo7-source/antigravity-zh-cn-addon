#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const source = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0] || 'install';
const flag = args.indexOf('--patch-dir');
if (flag !== -1 && !args[flag + 1]) throw Error('--patch-dir requires a path');
const target = path.resolve(flag === -1 ? path.join(os.homedir(), '.gemini/antigravity/theme-patch') : args[flag + 1]);
const user = path.join(target, 'user');
const stateFile = path.join(target, 'zh-cn-addon-install.json');
const names = ['i18n.override.json', 'custom.js'];
const read = p => fs.readFileSync(p, 'utf8');
const parse = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const state = fs.existsSync(stateFile) ? parse(read(stateFile)) : null;

// 不静默覆盖手动改动；此检查同时用于升级和卸载。
function checkManagedFiles() {
  if (!state) return;
  for (const name of names) {
    if (hash(read(path.join(user, name))) !== state.installedHashes[name]) {
      throw Error(`${name} was edited after installation. Save your changes and merge manually before replacing it.`);
    }
  }
}
function write(p, content) {
  const temporary = `${p}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, content, 'utf8'); fs.renameSync(temporary, p); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

if (!fs.existsSync(path.join(target, 'core/daemon.mjs'))) throw Error('Install the upstream theme patch first. See README.md.');
if (!['install', 'uninstall'].includes(command)) throw Error('Usage: node install.mjs install|uninstall [--patch-dir DIR]');
checkManagedFiles();

if (command === 'uninstall') {
  if (!state) { console.log('Add-on is not installed.'); process.exit(0); }
  for (const name of names) {
    const backup = path.resolve(state.backupDir, name);
    if (!backup.startsWith(path.join(target, 'backups') + path.sep)) throw Error('Unexpected backup location');
    if (!fs.existsSync(backup)) throw Error(`Missing backup: ${name}`);
  }
  const current = Object.fromEntries(names.map(name => [name, read(path.join(user, name))]));
  try {
    for (const name of names) write(path.join(user, name), read(path.join(state.backupDir, name)));
    fs.unlinkSync(stateFile);
  } catch (error) {
    for (const name of names) write(path.join(user, name), current[name]);
    throw error;
  }
  console.log('Original user files restored. The upstream daemon will reload them.');
} else {
  const config = parse(read(path.join(user, 'config.json')));
  if (config.enabled === false || config.modules?.i18n === false || config.modules?.customJs === false) {
    throw Error('Enable the upstream patch, i18n and customJs modules first.');
  }
  const before = Object.fromEntries(names.map(name => [name, read(path.join(user, name))]));
  const base = state ? Object.fromEntries(names.map(name => [name, read(path.join(state.backupDir, name))])) : before;
  const originalDict = parse(base['i18n.override.json']);
  const additions = parse(read(path.join(source, 'i18n.override.json')));
  for (const d of [originalDict, additions]) {
    if (!d || Array.isArray(d) || typeof d !== 'object') throw Error('Translation dictionary must be an object');
  }
  if (Object.values(additions).some(v => typeof v !== 'string')) throw Error('Add-on translations must be strings');
  const wrapped = Object.hasOwn(originalDict, 'exact');
  const originalEntries = wrapped ? originalDict.exact : originalDict;
  if (!originalEntries || Array.isArray(originalEntries) || typeof originalEntries !== 'object' || Object.values(originalEntries).some(v => typeof v !== 'string')) {
    throw Error('Existing translations must be a string dictionary');
  }
  const entries = Object.fromEntries([...Object.entries(originalEntries), ...Object.entries(additions)]);
  const merged = wrapped ? { ...originalDict, exact: entries } : entries;
  const installed = {
    'i18n.override.json': JSON.stringify(merged, null, 2) + '\n',
    'custom.js': base['custom.js'] + '\n// BEGIN antigravity-zh-cn-addon\n' + read(path.join(source, 'custom.js')) + '\n// END antigravity-zh-cn-addon\n'
  };
  if (state && names.every(name => installed[name] === before[name])) {
    console.log('Add-on is already current.'); process.exit(0);
  }
  const backupDir = state?.backupDir || path.join(target, 'backups', 'zh-cn-addon-' + new Date().toISOString().replace(/[:.]/g, '-'));
  if (!state) {
    fs.mkdirSync(backupDir, { recursive: true });
    for (const name of names) fs.copyFileSync(path.join(user, name), path.join(backupDir, name));
  }
  try {
    for (const name of names) write(path.join(user, name), installed[name]);
    write(stateFile, JSON.stringify({ version: '1.0.0', backupDir, installedHashes: Object.fromEntries(names.map(name => [name, hash(installed[name])])) }, null, 2) + '\n');
  } catch (error) {
    for (const name of names) write(path.join(user, name), before[name]);
    throw error;
  }
  console.log(JSON.stringify({ ok: true, version: '1.0.0', entries: Object.keys(additions).length, backupDir }, null, 2));
}
