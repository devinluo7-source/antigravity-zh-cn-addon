// Antigravity 简体中文补充包，MIT。由船板补丁的 user/custom.js 钩子加载。
// ponytail: 仅扩充已有运行时；上游负责连接、自启和基础词典。
(() => {
  if (!ctx.modules.i18n) return;
  const protectedContent = 'pre,code,kbd,samp,textarea,input,[contenteditable="true"],[data-markdown-root],[data-testid="user-message-content"],.agy-user-bubble,.monaco-editor,.monaco-diff-editor,.xterm,.msg-body,.prose,.markdown,[class*="chat-message"],[data-testid="swarm-raw"]';
  const conversation = '[data-testid="agent-response"],[data-testid="user-message-content"],.agy-user-bubble,[contenteditable="true"],pre,code,.monaco-editor,.xterm,.prose,.markdown,[class*="chat-message"]';
  const metrics = '#ag-live-metrics-pill,[data-ag-metrics-pill="1"],#ag-live-metrics-tooltip';
  const textRecords = new Map();
  const attributeRecords = new Map();
  let queued = false;
  let stopped = false;

  function translate(raw, metric = false) {
    const text = raw.trim();
    if (typeof ctx.dict[text] === 'string') return raw.replace(text, () => ctx.dict[text]);
    const weekly = /^You have used some of your weekly limit, it will fully refresh in (.+)\.$/.exec(text);
    if (weekly) return '本周额度已使用一部分，将在 ' + weekly[1]
      .replace(/(\d+) days?\b/g, '$1 天').replace(/(\d+) hours?\b/g, '$1 小时')
      .replace(/(\d+) minutes?\b/g, '$1 分钟').replace(/, /g, ' ') + '后完全刷新。';
    if (!metric) return raw;
    return raw.replace(/\btok\/s\b/g, '词元/秒')
      .replace(/\bTTFT\b/g, '首字耗时').replace(/\bHold\b/g, '等待耗时')
      .replace(/\bCtx\b/g, '上下文').replace(/\bOut\b/g, '输出')
      .replace(/(\d+(?:\.\d+)?)s\b/g, '$1秒')
      .replace(/\b(\d+) sub\b/g, '$1 个子助手');
  }

  function applyText(node, metric) {
    const current = node.nodeValue;
    const previous = textRecords.get(node);
    const original = previous?.last === current ? previous.original : current;
    const translated = translate(original, metric);
    if (translated === current) return;
    textRecords.set(node, { original, last: translated });
    node.nodeValue = translated;
  }

  function walk(root, metric = false, onboarding = false) {
    if (root.closest(conversation)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (parent.closest('pre,code,textarea,input,[contenteditable="true"],script,style')) continue;
      if (!onboarding && !metric && parent.closest(protectedContent)) continue;
      applyText(node, metric);
    }
  }

  function scan() {
    if (stopped) return;
    // 保留上游对聊天正文的保护，只对白名单中的产品搜索引导放行 Markdown。
    for (const heading of document.querySelectorAll('div.text-lg.font-medium.text-foreground')) {
      if (!['Search Across Conversations', '搜索全部对话'].includes(heading.textContent.trim())) continue;
      const card = heading.parentElement;
      if (!card.closest(conversation) && card.querySelector('button')) walk(card, false, true);
    }
    for (const root of document.querySelectorAll(metrics)) walk(root, true);
    for (const root of document.querySelectorAll('.settings-modal-container')) walk(root);
    for (const el of document.querySelectorAll('button[aria-label],button[title],[role="combobox"][aria-label]')) {
      if (el.closest(protectedContent)) continue;
      for (const attr of ['aria-label', 'title']) {
        const current = el.getAttribute(attr);
        if (!current) continue;
        const records = attributeRecords.get(el) || {};
        const previous = records[attr];
        const original = previous?.last === current ? previous.original : current;
        const translated = translate(original);
        if (translated === current) continue;
        records[attr] = { original, last: translated };
        attributeRecords.set(el, records);
        el.setAttribute(attr, translated);
      }
    }
    // ponytail: 断开的节点不保留，避免长会话累积引用；无需另加缓存系统。
    for (const node of textRecords.keys()) if (!node.isConnected) textRecords.delete(node);
    for (const node of attributeRecords.keys()) if (!node.isConnected) attributeRecords.delete(node);
  }

  const observer = new MutationObserver(records => {
    if (queued || stopped) return;
    if (!records.some(r => {
      const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      return el && (!el.closest(protectedContent) || el.closest(metrics));
    })) return;
    queued = true;
    queueMicrotask(() => { queued = false; scan(); });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
  const api = { version: '1.0.0', scan, translate };
  window.__ag_zh_addon = api;
  scan();
  ctx.onCleanup(() => {
    stopped = true;
    observer.disconnect();
    for (const [node, record] of textRecords) if (node.isConnected && node.nodeValue === record.last) node.nodeValue = record.original;
    for (const [node, records] of attributeRecords) for (const [attr, record] of Object.entries(records)) {
      if (node.isConnected && node.getAttribute(attr) === record.last) node.setAttribute(attr, record.original);
    }
    if (window.__ag_zh_addon === api) delete window.__ag_zh_addon;
  });
})();
