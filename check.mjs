#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const source = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 9222);
assert(Number.isInteger(port) && port > 0 && port <= 65535, 'Invalid port');
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
const target = targets.find(t => {
  try { const url = new URL(t.url); return t.type === 'page' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !t.title.includes('Launchpad'); }
  catch { return false; }
});
assert(target, 'Open Antigravity with a loopback CDP port first.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { ws.close(); reject(Error('Connection timeout')); }, 5000);
  ws.onopen = () => { clearTimeout(timer); resolve(); };
  ws.onerror = () => { clearTimeout(timer); reject(Error('Connection failed')); };
});
try {
  const sourceCode = fs.readFileSync(path.join(source, 'custom.js'), 'utf8');
  const dictionary = JSON.parse(fs.readFileSync(path.join(source, 'i18n.override.json'), 'utf8'));
  const expression = `(${(async (code, dict) => {
    if (!window.__AG_PATCH_CTX__ || !window.__ag_zh_addon) throw Error('Live add-on is not loaded');
    for (const [key, value] of Object.entries(dict)) if (window.__AG_PATCH_CTX__.dict[key] !== value) throw Error('Live dictionary is stale: ' + key);
    // 使用独立 HTML 文档做检查，不在实际聊天或输入框内加入测试内容。
    const testDocument = document.implementation.createHTMLDocument('zh-addon-check');
    const isolatedWindow = {};
    const cleanup = [];
    const fixture = `<div data-ag-metrics-pill="1">123 tok/s · TTFT 1.2s · Ctx 14k/256k · Out 238 · +2 sub</div>
      <div id="onboarding"><div class="text-lg font-medium text-foreground">Search Across Conversations</div><p data-markdown-root>Search conversations with <svg></svg> in the top left.</p><button>Dismiss</button></div>
      <div class="settings-modal-container"><span>Side Question Selection</span><button aria-label="Background color picker">Color</button><p>You have used some of your weekly limit, it will fully refresh in 6 days, 9 hours.</p></div>
      <pre>Search Across Conversations</pre><code>Side Question Selection</code>
      <div class="xterm">Search Across Conversations</div><div class="prose">Search Across Conversations</div>
      <textarea>Search Across Conversations</textarea><div contenteditable="true">Search Across Conversations</div>
      <div data-markdown-root>Search conversations with</div>
      <div data-testid="user-message-content"><button aria-label="System">Search Across Conversations</button></div>
      <div data-testid="agent-response"><div><div class="text-lg font-medium text-foreground">Search Across Conversations</div><button>Dismiss</button></div></div>`;
    testDocument.body.innerHTML = fixture;
    const svg = testDocument.querySelector('svg');
    new Function('ctx', 'document', 'window', code)({ modules: { i18n: true }, dict, onCleanup: fn => cleanup.push(fn) }, testDocument, isolatedWindow);
    const require = (condition, message) => { if (!condition) throw Error(message); };
    const metric = testDocument.querySelector('[data-ag-metrics-pill]');
    try {
    require(window.__ag_zh_addon.translate.toString() === isolatedWindow.__ag_zh_addon.translate.toString(), 'Live translation hook is stale');
    require(metric.textContent.includes('123 词元/秒') && metric.textContent.includes('首字耗时 1.2秒') && metric.textContent.includes('上下文') && metric.textContent.includes('输出') && metric.textContent.includes('2 个子助手'), 'Metric labels failed');
    require(testDocument.querySelector('#onboarding p').textContent.replace(/\s+/g, ' ') === '点击左上角的 搜索对话。', 'Onboarding fragments failed');
    require(testDocument.querySelector('svg') === svg, 'Onboarding icon was replaced');
    require(testDocument.querySelector('.settings-modal-container span').textContent === '就选中内容发起支线提问', 'Settings text failed');
    require(testDocument.querySelector('.settings-modal-container button').getAttribute('aria-label') === '选择背景色', 'Accessible label failed');
    require(testDocument.querySelector('.settings-modal-container p').textContent.includes('6 天 9 小时'), 'Dynamic reset time failed');
    for (const selector of ['pre','.xterm','.prose','textarea','[contenteditable]','[data-testid="user-message-content"]','[data-testid="agent-response"]']) {
      require(testDocument.querySelector(selector).textContent.includes('Search Across Conversations'), 'Protected content changed: ' + selector);
    }
    require(testDocument.querySelector('code').textContent === 'Side Question Selection', 'Code changed');
    require(testDocument.querySelector('body > [data-markdown-root]').textContent === 'Search conversations with', 'Ordinary Markdown changed');
    require(testDocument.querySelector('[data-testid="user-message-content"] button').getAttribute('aria-label') === 'System', 'User content attribute changed');
    metric.textContent = '456 tok/s';
    for (let i = 0; i < 6; i++) await Promise.resolve();
    require(metric.textContent === '456 词元/秒', 'Live update observer failed');
    } finally { cleanup.forEach(fn => fn()); }
    require(metric.textContent === '456 tok/s' && !isolatedWindow.__ag_zh_addon, 'Cleanup failed');
    require(testDocument.querySelector('#onboarding p').textContent === 'Search conversations with  in the top left.', 'Cleanup did not restore onboarding');
    return { ok: true, addonVersion: window.__ag_zh_addon.version, upstreamVersion: window.__ag_patch_version, dictionaryCount: Object.keys(window.__AG_PATCH_CTX__.dict).length, checks: ['metrics', 'onboarding', 'icons', 'settings', 'accessibility', 'dynamic-reset', 'chat-code-input-protection', 'live-update', 'cleanup'] };
  }).toString()})(${JSON.stringify(sourceCode)},${JSON.stringify(dictionary)})`;
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Check timed out')), 10000);
    ws.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      if (message.error) reject(Error(JSON.stringify(message.error)));
      else if (message.result.exceptionDetails) reject(Error(message.result.exceptionDetails.exception?.description || message.result.exceptionDetails.text));
      else resolve(message.result.result.value);
    };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });
  assert.equal(result?.ok, true);
  console.log(JSON.stringify(result, null, 2));
} finally { ws.close(); }
