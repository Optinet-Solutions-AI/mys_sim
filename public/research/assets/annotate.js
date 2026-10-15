/* Highlight-and-comment layer for the research pages.
   Select text inside <main> to highlight it or attach a comment. Notes persist in this browser
   (localStorage, keyed per document) and export to Markdown or JSON so they can be fed into the next document.
   Opt a page in with: <script src="assets/annotate.js"></script> before </body>. */
(function () {
  'use strict';
  var ROOT = document.querySelector('main');
  if (!ROOT) return;
  var DOC = (location.pathname.split('/').pop() || 'document').replace(/\.html?$/, '');
  var KEY = 'gn-notes:' + DOC;
  var notes = [];
  var storageOK = true;
  try { notes = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { notes = []; }
  try { localStorage.setItem(KEY + ':probe', '1'); localStorage.removeItem(KEY + ':probe'); } catch (e) { storageOK = false; }

  /* ---------- styles (use the page's design tokens) ---------- */
  var css = [
    'mark.gn-hl{background:rgba(240,190,60,.38);color:inherit;border-radius:2px;cursor:pointer;padding:0 1px}',
    'mark.gn-hl.has-note{background:rgba(240,190,60,.38);border-bottom:2px solid var(--accent)}',
    'mark.gn-hl.flash{outline:2px solid var(--accent);outline-offset:1px}',
    '.gn-bar{position:absolute;z-index:50;display:flex;gap:2px;background:var(--ink);border-radius:6px;padding:3px;box-shadow:0 6px 18px rgba(0,0,0,.2)}',
    '.gn-bar button{font-family:var(--display);font-size:15px;font-weight:600;letter-spacing:.02em;background:transparent;color:var(--bg);border:0;border-radius:4px;padding:6px 10px;cursor:pointer}',
    '.gn-bar button:hover,.gn-bar button:focus-visible{background:rgba(127,127,127,.35);outline:none}',
    '.gn-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:55;font-family:var(--display);font-size:16px;font-weight:600;background:var(--accent);color:var(--surface);border:0;border-radius:999px;padding:10px 16px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.18)}',
    '.gn-fab:focus-visible{outline:2px solid var(--ink);outline-offset:2px}',
    '.gn-panel{position:fixed;top:0;right:0;height:100%;width:min(400px,100vw);z-index:60;background:var(--surface);color:var(--ink);border-left:1px solid var(--line);box-shadow:-10px 0 30px rgba(0,0,0,.12);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .2s ease;padding-top:env(safe-area-inset-top,0px)}',
    '.gn-panel.open{transform:none}',
    '@media (prefers-reduced-motion:reduce){.gn-panel{transition:none}}',
    '.gn-head{padding:16px 18px 10px;border-bottom:1px solid var(--line)}',
    '.gn-head h2{font-family:var(--display);font-size:24px;margin:0;border:0;padding:0;display:flex;justify-content:space-between;align-items:center}',
    '.gn-head .gn-x{font-family:var(--display);font-size:15px;background:none;border:1px solid var(--line);color:var(--ink-2);border-radius:4px;padding:3px 9px;cursor:pointer}',
    '.gn-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.gn-actions button,.gn-item button{font-family:var(--display);font-size:14px;font-weight:600;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:4px 9px;cursor:pointer}',
    '.gn-actions button:hover,.gn-item button:hover{border-color:var(--accent)}',
    '.gn-actions button.danger,.gn-item button.danger{color:var(--bad)}',
    '.gn-status{font-family:var(--display);font-size:13px;color:var(--ink-3);margin-top:8px;min-height:1em}',
    '.gn-list{overflow:auto;padding:8px 18px 80px;flex:1}',
    '.gn-empty{color:var(--ink-2);font-size:15px;margin-top:16px}',
    '.gn-item{border-bottom:1px solid var(--line);padding:12px 0}',
    '.gn-item.focus{background:var(--accent-soft);margin:0 -18px;padding:12px 18px}',
    '.gn-sec{font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent-ink);font-weight:600}',
    '.gn-quote{margin:6px 0 8px;padding-left:10px;border-left:3px solid rgba(240,190,60,.8);font-size:14.5px;line-height:1.45;color:var(--ink-2)}',
    '.gn-orphan{font-family:var(--display);font-size:13px;color:var(--warn)}',
    '.gn-item textarea{width:100%;min-height:64px;resize:vertical;font-family:var(--body);font-size:15px;line-height:1.4;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:7px 9px}',
    '.gn-item textarea:focus{outline:2px solid var(--accent);outline-offset:0;border-color:transparent}',
    '.gn-row{display:flex;gap:6px;margin-top:6px}',
    '@media print{.gn-bar,.gn-fab,.gn-panel{display:none!important}mark.gn-hl{background:none;border-bottom:1px solid #999}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- text model ---------- */
  function uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nodes() {
    var w = document.createTreeWalker(ROOT, NodeFilter.SHOW_TEXT, null), a = [], n, p = 0;
    while ((n = w.nextNode())) { a.push({ n: n, s: p }); p += n.nodeValue.length; }
    return a;
  }
  function fullText(a) { return a.map(function (x) { return x.n.nodeValue; }).join(''); }
  function offsetOf(container, offset) {
    var r = document.createRange(); r.setStart(ROOT, 0); r.setEnd(container, offset);
    return r.toString().length;
  }
  function locate(note, text) {
    if (text.slice(note.start, note.end) === note.quote) return [note.start, note.end];
    var best = -1, bestScore = -Infinity, i = text.indexOf(note.quote);
    while (i !== -1) {
      var sc = 0;
      if (text.slice(Math.max(0, i - note.prefix.length), i) === note.prefix) sc += 2;
      if (text.slice(i + note.quote.length, i + note.quote.length + note.suffix.length) === note.suffix) sc += 2;
      sc -= Math.abs(i - note.start) / 1e6;
      if (sc > bestScore) { bestScore = sc; best = i; }
      i = text.indexOf(note.quote, i + 1);
    }
    return best === -1 ? null : [best, best + note.quote.length];
  }
  function wrap(note) {
    var a = nodes(), loc = locate(note, fullText(a));
    if (!loc) { note.orphan = true; return; }
    note.orphan = false; note.start = loc[0]; note.end = loc[1];
    var s = loc[0], e = loc[1];
    for (var k = 0; k < a.length; k++) {
      var x = a[k], ns = x.s, ne = x.s + x.n.nodeValue.length;
      if (ne <= s || ns >= e) continue;
      var node = x.n, from = Math.max(s, ns) - ns, to = Math.min(e, ne) - ns;
      if (!node.nodeValue.slice(from, to).trim()) continue;
      if (node.parentElement && node.parentElement.closest('svg, textarea')) continue;
      var mid = from > 0 ? node.splitText(from) : node;
      if (to - from < mid.nodeValue.length) mid.splitText(to - from);
      var m = document.createElement('mark');
      m.className = 'gn-hl' + (note.note ? ' has-note' : '');
      m.dataset.id = note.id;
      m.title = note.note ? 'Comment: ' + note.note : 'Highlight';
      mid.parentNode.insertBefore(m, mid); m.appendChild(mid);
    }
  }
  function marks(id) { return ROOT.querySelectorAll('mark.gn-hl[data-id="' + id + '"]'); }
  function unwrap(id) {
    Array.prototype.forEach.call(marks(id), function (m) {
      var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m); p.normalize();
    });
  }
  function sectionLabel(el) {
    var sec = el.closest('section'); if (!sec) return '';
    var label = '', hs = sec.querySelectorAll('h2, h3');
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) label = hs[i].textContent.trim();
    }
    if (!label && hs.length) label = hs[0].textContent.trim();
    return label;
  }

  /* ---------- persistence ---------- */
  function store() { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { storageOK = false; } }
  function persist() { store(); renderPanel(); }
  function sorted() { return notes.slice().sort(function (a, b) { return (a.orphan - b.orphan) || a.start - b.start; }); }

  /* ---------- create from selection ---------- */
  var currentRange = null;
  function create(withNote) {
    if (!currentRange) return;
    var s = offsetOf(currentRange.startContainer, currentRange.startOffset);
    var e = offsetOf(currentRange.endContainer, currentRange.endOffset);
    var text = fullText(nodes());
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e <= s) return;
    var note = {
      id: uid(), start: s, end: e, quote: text.slice(s, e),
      prefix: text.slice(Math.max(0, s - 40), s), suffix: text.slice(e, e + 40),
      note: '', section: '', created: new Date().toISOString()
    };
    notes.push(note); wrap(note);
    var first = marks(note.id)[0]; note.section = first ? sectionLabel(first) : '';
    window.getSelection().removeAllRanges(); hideBar(); persist();
    if (withNote) openPanel(note.id, true); else status('Highlight saved');
  }

  /* ---------- selection toolbar ---------- */
  var bar = document.createElement('div'); bar.className = 'gn-bar'; bar.hidden = true;
  bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Annotate selection');
  var bHi = document.createElement('button'); bHi.type = 'button'; bHi.textContent = 'Highlight';
  var bNote = document.createElement('button'); bNote.type = 'button'; bNote.textContent = 'Add note';
  bar.appendChild(bHi); bar.appendChild(bNote); document.body.appendChild(bar);
  bar.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
  bHi.addEventListener('click', function () { create(false); });
  bNote.addEventListener('click', function () { create(true); });
  function hideBar() { bar.hidden = true; currentRange = null; }
  function checkSel() {
    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { hideBar(); return; }
    var r = sel.getRangeAt(0);
    if (!ROOT.contains(r.commonAncestorContainer) || !r.toString().trim()) { hideBar(); return; }
    currentRange = r.cloneRange();
    var rect = r.getBoundingClientRect();
    bar.hidden = false;
    var w = bar.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8) + window.pageXOffset;
    var top = rect.top - bar.offsetHeight - 8;
    if (top < 8) top = rect.bottom + 8;
    bar.style.left = left + 'px'; bar.style.top = (top + window.pageYOffset) + 'px';
  }
  var selTimer = null;
  document.addEventListener('mouseup', function (ev) { if (!bar.contains(ev.target)) setTimeout(checkSel, 10); });
  document.addEventListener('keyup', function (ev) { if (ev.shiftKey || ev.key === 'Shift') checkSel(); });
  document.addEventListener('selectionchange', function () { clearTimeout(selTimer); selTimer = setTimeout(checkSel, 350); });

  /* ---------- panel ---------- */
  var fab = document.createElement('button'); fab.type = 'button'; fab.className = 'gn-fab';
  document.body.appendChild(fab);
  var panel = document.createElement('aside'); panel.className = 'gn-panel'; panel.setAttribute('aria-label', 'Your notes');
  panel.innerHTML =
    '<div class="gn-head"><h2><span>Your notes</span><button type="button" class="gn-x">Close</button></h2>' +
    '<div class="gn-actions">' +
    '<button type="button" data-act="copy">Copy as Markdown</button>' +
    '<button type="button" data-act="md">Download .md</button>' +
    '<button type="button" data-act="json">Download .json</button>' +
    '<button type="button" data-act="import">Import .json</button>' +
    '<button type="button" data-act="clear" class="danger">Clear all</button>' +
    '</div><div class="gn-status" aria-live="polite"></div></div>' +
    '<div class="gn-list"></div>' +
    '<input type="file" accept="application/json,.json" hidden>';
  document.body.appendChild(panel);
  var list = panel.querySelector('.gn-list'), statusEl = panel.querySelector('.gn-status'), fileIn = panel.querySelector('input[type=file]');
  function status(msg) { statusEl.textContent = msg; clearTimeout(status.t); status.t = setTimeout(function () { statusEl.textContent = storageOK ? '' : 'This browser is not saving notes. Download them before closing.'; }, 2500); }
  function openPanel(id, focusText) {
    panel.classList.add('open');
    if (!id) return;
    var item = list.querySelector('[data-id="' + id + '"]');
    if (!item) return;
    Array.prototype.forEach.call(list.querySelectorAll('.gn-item.focus'), function (x) { x.classList.remove('focus'); });
    item.classList.add('focus'); item.scrollIntoView({ block: 'nearest' });
    if (focusText) item.querySelector('textarea').focus();
  }
  function closePanel() { panel.classList.remove('open'); }
  fab.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); });
  panel.querySelector('.gn-x').addEventListener('click', closePanel);

  function renderPanel() {
    fab.textContent = 'Notes (' + notes.length + ')';
    list.textContent = '';
    if (!notes.length) {
      var p = document.createElement('p'); p.className = 'gn-empty';
      p.textContent = 'Select any text on the page, then choose Highlight or Add note. Your notes appear here.';
      list.appendChild(p); return;
    }
    sorted().forEach(function (n) {
      var item = document.createElement('div'); item.className = 'gn-item'; item.dataset.id = n.id;
      var sec = document.createElement('div'); sec.className = 'gn-sec'; sec.textContent = n.section || 'Untitled section';
      var q = document.createElement('div'); q.className = 'gn-quote';
      q.textContent = n.quote.length > 320 ? n.quote.slice(0, 317) + '…' : n.quote;
      item.appendChild(sec); item.appendChild(q);
      if (n.orphan) { var o = document.createElement('div'); o.className = 'gn-orphan'; o.textContent = 'This text is no longer in the document. The note is kept.'; item.appendChild(o); }
      var ta = document.createElement('textarea'); ta.placeholder = 'Add a comment (optional)'; ta.value = n.note || '';
      ta.setAttribute('aria-label', 'Comment on: ' + n.quote.slice(0, 60));
      ta.addEventListener('input', function () {
        n.note = ta.value; n.updated = new Date().toISOString();
        Array.prototype.forEach.call(marks(n.id), function (m) { m.classList.toggle('has-note', !!n.note); m.title = n.note ? 'Comment: ' + n.note : 'Highlight'; });
        store();
      });
      var row = document.createElement('div'); row.className = 'gn-row';
      var go = document.createElement('button'); go.type = 'button'; go.textContent = 'Go to'; go.disabled = !!n.orphan;
      go.addEventListener('click', function () {
        var ms = marks(n.id); if (!ms.length) return;
        ms[0].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        Array.prototype.forEach.call(ms, function (m) { m.classList.add('flash'); setTimeout(function () { m.classList.remove('flash'); }, 1600); });
        if (window.innerWidth < 700) closePanel();
      });
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'danger'; rm.textContent = 'Remove';
      rm.addEventListener('click', function () {
        unwrap(n.id); notes = notes.filter(function (x) { return x.id !== n.id; }); persist(); status('Note removed');
      });
      row.appendChild(go); row.appendChild(rm);
      item.appendChild(ta); item.appendChild(row); list.appendChild(item);
    });
  }

  /* ---------- export / import ---------- */
  function toMarkdown() {
    var out = ['# Notes on ' + document.title, '', '- Document: `' + DOC + '.html`',
      '- Exported: ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
      '- Notes: ' + notes.length + ' (' + notes.filter(function (n) { return n.note; }).length + ' with comments)', ''];
    var lastSec = null;
    sorted().forEach(function (n) {
      var secName = n.section || 'Untitled section';
      if (secName !== lastSec) { out.push('## ' + secName, ''); lastSec = secName; }
      out.push('> ' + n.quote.replace(/\s+/g, ' '), '');
      out.push(n.note ? '**Comment:** ' + n.note.replace(/\n+/g, ' ') : '_Highlight only, no comment._');
      if (n.orphan) out.push('', '_Note: this text is no longer in the current version of the document._');
      out.push('');
    });
    return out.join('\n');
  }
  function download(name, content, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  panel.querySelector('.gn-actions').addEventListener('click', function (ev) {
    var act = ev.target.getAttribute && ev.target.getAttribute('data-act'); if (!act) return;
    if (act === 'copy') {
      var md = toMarkdown();
      var fallback = function () {
        var t = document.createElement('textarea'); t.value = md; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); status('Copied'); } catch (e) { status('Copy failed. Use Download .md'); }
        t.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(function () { status('Copied as Markdown'); }, fallback);
      else fallback();
    } else if (act === 'md') { download(DOC + '-notes.md', toMarkdown(), 'text/markdown'); status('Downloaded ' + DOC + '-notes.md'); }
    else if (act === 'json') { download(DOC + '-notes.json', JSON.stringify({ doc: DOC, exported: new Date().toISOString(), notes: notes }, null, 2), 'application/json'); status('Downloaded ' + DOC + '-notes.json'); }
    else if (act === 'import') { fileIn.click(); }
    else if (act === 'clear') {
      if (!notes.length) return;
      if (ev.target.dataset.armed) {
        notes.forEach(function (n) { unwrap(n.id); }); notes = []; persist(); status('All notes cleared');
        delete ev.target.dataset.armed; ev.target.textContent = 'Clear all';
      } else {
        ev.target.dataset.armed = '1'; ev.target.textContent = 'Click again to clear';
        setTimeout(function () { delete ev.target.dataset.armed; ev.target.textContent = 'Clear all'; }, 3000);
      }
    }
  });
  fileIn.addEventListener('change', function () {
    var f = fileIn.files && fileIn.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result), incoming = Array.isArray(data) ? data : data.notes || [];
        var have = {}; notes.forEach(function (n) { have[n.id] = true; });
        var added = 0;
        incoming.forEach(function (n) { if (n && n.id && n.quote && !have[n.id]) { notes.push(n); wrap(n); added++; } });
        persist(); status('Imported ' + added + ' note' + (added === 1 ? '' : 's'));
      } catch (e) { status('That file is not a notes export'); }
      fileIn.value = '';
    };
    rd.readAsText(f);
  });

  /* ---------- clicks on highlights, escape ---------- */
  ROOT.addEventListener('click', function (ev) {
    var m = ev.target.closest && ev.target.closest('mark.gn-hl');
    if (m && window.getSelection().isCollapsed) openPanel(m.dataset.id, false);
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { hideBar(); closePanel(); } });

  /* ---------- boot ---------- */
  notes.slice().sort(function (a, b) { return a.start - b.start; }).forEach(wrap);
  store();
  renderPanel();
  if (!storageOK) status('This browser is not saving notes. Download them before closing.');
})();
