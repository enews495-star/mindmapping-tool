'use strict';

/* ------------------------------------------------------------------ data */

const STORE_KEY = 'mindmap.v1';
const PALETTE = ['#e5484d', '#f76b15', '#d9a100', '#30a46c', '#12a594', '#3e63dd', '#8e4ec6', '#d6409f'];
const ROOT_COLOR = '#3e63dd';
const H_GAP = 46, V_GAP = 14;

const EMOJI = {
  'Ideas': '💡 ⭐ 🌟 ✨ 🔥 🎯 🚀 🧠 💭 💬 ❓ ❗ ✅ ❌ ⚠️ 🔑 🔒 🏆 🎉 🎁 📌 📍 🔔 ⏰ ⏳ 🧩 🔍 💎 ♻️ ➕',
  'Work': '📝 📚 📖 📅 📊 📈 📉 💼 📁 📎 ✏️ 🖊️ 💻 📱 🖥️ ⌨️ 📷 🎥 📞 ✉️ 📦 🛠️ ⚙️ 🧪 🔬 🧮 💰 💳 🏦 🧾',
  'Faces': '😀 😄 😊 🙂 😉 😍 🤩 😎 🤔 🧐 😴 😅 😂 😭 😡 😱 🥳 🤯 😇 🤗 🙃 😬 🤓 😤 🥺 👻 🤖 👽 💩 🙈',
  'People': '👍 👎 👏 🙌 🙏 💪 👀 ✋ 👋 🤝 ✌️ 🤞 👉 👈 👆 👇 ❤️ 💔 🧡 💛 💚 💙 💜 🖤 👤 👥 👶 🧑‍💻 🧑‍🎓 🧑‍🍳',
  'Nature': '🌱 🌳 🌲 🌴 🌵 🌸 🌻 🍀 🍂 🌍 🌙 ☀️ ⛅ 🌧️ ⚡ ❄️ 🌈 🌊 🐶 🐱 🐭 🐻 🦊 🐼 🐸 🐵 🐦 🐝 🦋 🐠',
  'Food': '🍎 🍌 🍓 🍇 🍉 🍋 🥑 🥕 🌽 🍞 🧀 🍳 🍔 🍕 🌮 🍜 🍣 🍰 🍪 🍫 🍿 ☕ 🍵 🥤 🍺 🍷 🥗 🍚 🥐 🍩',
  'Places': '🏠 🏢 🏫 🏥 🏪 🏖️ ⛰️ 🏕️ 🗺️ 🚗 🚌 🚲 ✈️ 🚆 🚢 ⛽ 🛒 🎒 🧳 🛏️ 🚪 🪑 🧹 🧺 🚿 🌆 🌉 🗽 🎡 ⛺',
  'Fun': '⚽ 🏀 🎾 🏃 🚴 🏊 🧘 🎮 🎲 🎨 🎵 🎸 🎹 🎤 🎬 📺 📸 🎭 🎪 🏋️ 🥇 🎈 🎂 🎄 🎃 🧸 🪁 🎣 ♟️ 🧶',
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mk = (text, emoji = '', extra = {}) => ({ id: uid(), text, emoji, children: [], ...extra });

function starterMap() {
  const root = mk('My Mind Map', '🧠');
  const ideas = mk('Ideas', '💡', { color: PALETTE[5], side: 'right' });
  ideas.children.push(mk('Tap a node to select it'), mk('Double-tap to rename'));
  const todo = mk('To do', '✅', { color: PALETTE[3], side: 'right' });
  todo.children.push(mk('Add a branch', '➕'), mk('Pick an emoji', '😀'));
  const q = mk('Questions', '❓', { color: PALETTE[1], side: 'left' });
  root.children.push(ideas, todo, q);
  return { id: uid(), root, updated: Date.now() };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.maps && s.maps[s.current]) return s;
  } catch (e) { /* fall through to a fresh store */ }
  const m = starterMap();
  return { maps: { [m.id]: m }, current: m.id };
}

let store = loadStore();
let map = store.maps[store.current];
let selectedId = map.root.id;
let editingId = null;
let editSnapshot = null;
let undoStack = [], redoStack = [];
const view = { x: 0, y: 0, k: 1 };

function save() {
  map.updated = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage full or blocked */ }
}

function find(id, node = map.root, parent = null) {
  if (node.id === id) return { node, parent };
  for (const c of node.children) {
    const r = find(id, c, node);
    if (r) return r;
  }
  return null;
}
const count = n => 1 + n.children.reduce((a, c) => a + count(c), 0);

/* Run a change to the tree with an undo snapshot taken first. */
function change(fn) {
  undoStack.push(JSON.stringify(map.root));
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  fn();
  save();
  render();
}

function restore(from, to) {
  if (!from.length) return;
  commitEdit();
  to.push(JSON.stringify(map.root));
  map.root = JSON.parse(from.pop());
  if (!find(selectedId)) selectedId = map.root.id;
  save();
  render();
}

/* --------------------------------------------------------------- elements */

const $ = id => document.getElementById(id);
const viewport = $('viewport'), world = $('world'), nodesEl = $('nodes'), linksEl = $('links');
const els = new Map();      // node id -> element
let pos = new Map();        // node id -> {x, y, w, h, dir, color, parent}

const ICONS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  close: 'M6 6l12 12M18 6 6 18',
  child: 'M3 12h6M9 12c4 0 3-6 7-6M9 12c4 0 3 6 7 6M19 3v6M16 6h6',
  sibling: 'M12 5v14M5 12h14',
  emoji: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  color: 'M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.200 12 3 12 3Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};
const icon = name => `<svg class="ic" viewBox="0 0 24 24"><path d="${ICONS[name]}"/></svg>`;
[['btn-menu', 'menu'], ['btn-undo', 'undo'], ['btn-redo', 'redo'], ['btn-fit', 'fit'], ['sheet-close', 'close']]
  .forEach(([id, ic]) => { $(id).innerHTML = icon(ic); });
[['btn-child', 'child'], ['btn-sibling', 'sibling'], ['btn-emoji', 'emoji'], ['btn-edit', 'edit'], ['btn-color', 'color'], ['btn-delete', 'trash']]
  .forEach(([id, ic]) => { $(id).querySelector('i').innerHTML = icon(ic); });

/* ----------------------------------------------------------------- render */

function createNodeEl(id) {
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = id;
  el.innerHTML = '<span class="emoji"></span><span class="text"></span>';
  const text = el.lastChild;
  text.addEventListener('input', () => render());
  text.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey || e.key === 'Escape') { e.preventDefault(); text.blur(); }
    e.stopPropagation();
  });
  text.addEventListener('blur', () => { if (editingId === id) commitEdit(); });
  nodesEl.appendChild(el);
  els.set(id, el);
  return el;
}

function render() {
  // 1. Sync one element per visible node.
  const visible = [];
  (function walk(n, depth) {
    visible.push({ n, depth });
    if (!n.collapsed || depth === 0) n.children.forEach(c => walk(c, depth + 1));
  })(map.root, 0);

  const seen = new Set();
  for (const { n, depth } of visible) {
    seen.add(n.id);
    const el = els.get(n.id) || createNodeEl(n.id);
    el.classList.toggle('root', depth === 0);
    el.classList.toggle('deep', depth > 1);
    el.classList.toggle('selected', n.id === selectedId);
    el.firstChild.textContent = n.emoji || '';
    const text = el.children[1];
    if (n.id !== editingId && text.textContent !== n.text) text.textContent = n.text;

    let toggle = el.querySelector('.toggle');
    if (depth > 0 && n.children.length) {
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.className = 'toggle';
        el.appendChild(toggle);
      }
      toggle.classList.toggle('open', !n.collapsed);
      toggle.textContent = n.collapsed ? count(n) - 1 : '';
      toggle.setAttribute('aria-label', n.collapsed ? 'Expand branch' : 'Collapse branch');
    } else if (toggle) toggle.remove();
  }
  for (const [id, el] of els) if (!seen.has(id)) { el.remove(); els.delete(id); }

  // 2. Measure, then lay out as a tree growing left and right from the root.
  const size = new Map();
  for (const { n } of visible) {
    const el = els.get(n.id);
    size.set(n.id, { w: el.offsetWidth, h: el.offsetHeight });
  }
  const kids = n => (n.collapsed && n !== map.root ? [] : n.children);
  const heights = new Map();
  const subH = n => {
    if (heights.has(n.id)) return heights.get(n.id);
    const ks = kids(n);
    const h = Math.max(size.get(n.id).h, ks.reduce((a, c) => a + subH(c), 0) + V_GAP * Math.max(0, ks.length - 1));
    heights.set(n.id, h);
    return h;
  };
  pos = new Map();
  const placeKids = (list, edgeX, cy, dir, color, parent) => {
    const total = list.reduce((a, c) => a + subH(c), 0) + V_GAP * Math.max(0, list.length - 1);
    let y = cy - total / 2;
    for (const c of list) {
      const h = subH(c), s = size.get(c.id), col = c.color || color;
      const x = dir > 0 ? edgeX : edgeX - s.w;
      const ccy = y + h / 2;
      pos.set(c.id, { x, y: ccy - s.h / 2, w: s.w, h: s.h, dir, color: col, parent });
      placeKids(kids(c), dir > 0 ? x + s.w + H_GAP : x - H_GAP, ccy, dir, col, c.id);
      y += h + V_GAP;
    }
  };
  const rs = size.get(map.root.id);
  const rootColor = map.root.color || ROOT_COLOR;
  pos.set(map.root.id, { x: -rs.w / 2, y: -rs.h / 2, w: rs.w, h: rs.h, dir: 0, color: rootColor, parent: null });
  placeKids(map.root.children.filter(c => c.side !== 'left'), rs.w / 2 + H_GAP, 0, 1, rootColor, map.root.id);
  placeKids(map.root.children.filter(c => c.side === 'left'), -rs.w / 2 - H_GAP, 0, -1, rootColor, map.root.id);

  // 3. Position nodes and draw the connecting curves.
  let d = '';
  for (const [id, p] of pos) {
    const el = els.get(id);
    el.style.transform = `translate(${p.x}px,${p.y}px)`;
    el.style.setProperty('--c', p.color);
    el.classList.toggle('left', p.dir < 0);
    if (!p.parent) continue;
    const pp = pos.get(p.parent);
    const x1 = p.dir > 0 ? pp.x + pp.w : pp.x, y1 = pp.y + pp.h / 2;
    const x2 = p.dir > 0 ? p.x : p.x + p.w, y2 = p.y + p.h / 2;
    const mx = (x1 + x2) / 2;
    d += `<path stroke="${p.color}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
  }
  linksEl.innerHTML = d;

  // 4. Chrome.
  $('title').textContent = (map.root.emoji ? map.root.emoji + ' ' : '') + map.root.text;
  $('btn-undo').disabled = !undoStack.length;
  $('btn-redo').disabled = !redoStack.length;
  $('btn-delete').disabled = selectedId === map.root.id;
  applyView();
}

/* ------------------------------------------------------------- view / pan */

function applyView() {
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  const g = 24 * view.k;
  viewport.style.backgroundSize = `${g}px ${g}px`;
  viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
}

/* The part of the screen not covered by the top bar and toolbar. */
function safeArea() {
  const r = viewport.getBoundingClientRect();
  const top = $('topbar').getBoundingClientRect().bottom + 12;
  const bottom = editingId ? r.bottom - 16 : $('toolbar').getBoundingClientRect().top - 12;
  return { left: 16, right: r.width - 16, top, bottom: Math.max(top + 60, bottom) };
}

function fit() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pos.values()) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h);
  }
  const a = safeArea();
  const k = Math.min(1, (a.right - a.left) / (x1 - x0 + 24), (a.bottom - a.top) / (y1 - y0 + 24));
  view.k = Math.max(0.25, k);
  view.x = (a.left + a.right) / 2 - (x0 + x1) / 2 * view.k;
  view.y = (a.top + a.bottom) / 2 - (y0 + y1) / 2 * view.k;
  applyView();
}

/* Pan just enough to bring a node on screen. */
function reveal(id) {
  const p = pos.get(id);
  if (!p) return;
  const a = safeArea();
  const l = p.x * view.k + view.x, t = p.y * view.k + view.y;
  const r = l + p.w * view.k, b = t + p.h * view.k;
  if (l < a.left) view.x += a.left - l; else if (r > a.right) view.x -= Math.min(r - a.right, l - a.left);
  if (t < a.top) view.y += a.top - t; else if (b > a.bottom) view.y -= b - a.bottom;
  applyView();
}

function zoomAt(cx, cy, factor) {
  const k = Math.min(2.5, Math.max(0.25, view.k * factor));
  view.x = cx - (cx - view.x) * (k / view.k);
  view.y = cy - (cy - view.y) * (k / view.k);
  view.k = k;
  applyView();
}

/* -------------------------------------------------------------- gestures */

const pointers = new Map();
let gesture = null;      // { target, moved, lastTap }
let lastTap = { id: null, t: 0 };

viewport.addEventListener('pointerdown', e => {
  const nodeEl = e.target.closest('.node');
  if (nodeEl && nodeEl.dataset.id === editingId && e.target.closest('.text')) return; // caret placement
  if (editingId) commitEdit();
  viewport.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    gesture = { nodeId: nodeEl && nodeEl.dataset.id, toggle: !!e.target.closest('.toggle'), moved: false, sx: e.clientX, sy: e.clientY };
  } else if (gesture) gesture.moved = true;
});

viewport.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 1) {
    if (!gesture.moved && Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) < 8) return;
    gesture.moved = true;
    view.x += e.clientX - p.x;
    view.y += e.clientY - p.y;
    applyView();
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const before = Math.hypot(a.x - b.x, a.y - b.y);
    const mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
    p.x = e.clientX; p.y = e.clientY;
    const after = Math.hypot(a.x - b.x, a.y - b.y);
    const mx1 = (a.x + b.x) / 2, my1 = (a.y + b.y) / 2;
    view.x += mx1 - mx0; view.y += my1 - my0;
    if (before > 0) zoomAt(mx1, my1, after / before); else applyView();
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
});

function pointerEnd(e) {
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size || !gesture) return;
  const g = gesture;
  gesture = null;
  if (g.moved || e.type === 'pointercancel') return;
  if (!g.nodeId) return;
  if (g.toggle) {
    change(() => { const { node } = find(g.nodeId); node.collapsed = !node.collapsed; });
    return;
  }
  const now = performance.now();
  const double = lastTap.id === g.nodeId && now - lastTap.t < 380;
  lastTap = { id: g.nodeId, t: now };
  selectedId = g.nodeId;
  render();
  if (double) startEdit(g.nodeId);
}
viewport.addEventListener('pointerup', pointerEnd);
viewport.addEventListener('pointercancel', pointerEnd);

viewport.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
}, { passive: false });
// Safari sends its own pinch events on top of pointer events; ignore them.
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));

/* --------------------------------------------------------------- editing */

function startEdit(id, fresh = false) {
  if (editingId) commitEdit();
  const el = els.get(id);
  if (!el) return;
  editingId = id;
  selectedId = id;
  editSnapshot = fresh ? null : JSON.stringify(map.root);
  const text = el.children[1];
  try { text.contentEditable = 'plaintext-only'; } catch (e) { text.contentEditable = 'true'; }
  render();
  text.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(text);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  reveal(id);
}

function commitEdit() {
  const id = editingId;
  if (!id) return;
  editingId = null;
  const el = els.get(id), found = find(id);
  if (!el || !found) return;
  const text = el.children[1];
  text.removeAttribute('contenteditable');
  getSelection().removeAllRanges();
  const value = text.textContent.replace(/\s+/g, ' ').trim() || 'New idea';
  if (value !== found.node.text) {
    if (editSnapshot) { undoStack.push(editSnapshot); redoStack = []; }
    found.node.text = value;
    save();
  }
  text.textContent = found.node.text;
  if (document.activeElement === text) text.blur();
  render();
}

/* --------------------------------------------------------------- actions */

function addChild() {
  commitEdit();
  const { node } = find(selectedId);
  const child = mk('');
  change(() => {
    if (node === map.root) {
      const left = node.children.filter(c => c.side === 'left').length;
      child.side = left < node.children.length - left ? 'left' : 'right';
      child.color = PALETTE[node.children.length % PALETTE.length];
    }
    node.collapsed = false;
    node.children.push(child);
  });
  startEdit(child.id, true);
}

function addSibling() {
  commitEdit();
  const { node, parent } = find(selectedId);
  if (!parent) return addChild();
  const sib = mk('');
  change(() => {
    if (parent === map.root) {
      sib.side = node.side;
      sib.color = PALETTE[parent.children.length % PALETTE.length];
    }
    parent.children.splice(parent.children.indexOf(node) + 1, 0, sib);
  });
  startEdit(sib.id, true);
}

function removeSelected() {
  commitEdit();
  const { node, parent } = find(selectedId);
  if (!parent) return;
  change(() => {
    parent.children.splice(parent.children.indexOf(node), 1);
    selectedId = parent.id;
  });
  reveal(selectedId);
}

$('btn-child').onclick = addChild;
$('btn-sibling').onclick = addSibling;
$('btn-delete').onclick = removeSelected;
$('btn-edit').onclick = () => startEdit(selectedId);
$('btn-undo').onclick = () => restore(undoStack, redoStack);
$('btn-redo').onclick = () => restore(redoStack, undoStack);
$('btn-fit').onclick = fit;
// Keep the keyboard from closing and reopening when a toolbar button is tapped mid-edit.
$('toolbar').addEventListener('pointerdown', e => { if (editingId) e.preventDefault(); });

document.addEventListener('keydown', e => {
  if (editingId || !$('sheet').hidden) { if (e.key === 'Escape') closeSheet(); return; }
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? restore(redoStack, undoStack) : restore(undoStack, redoStack); }
  else if (mod) return;
  else if (e.key === 'Tab') { e.preventDefault(); addChild(); }
  else if (e.key === 'Enter') { e.preventDefault(); addSibling(); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeSelected(); }
  else if (e.key === 'F2' || e.key === ' ') { e.preventDefault(); startEdit(selectedId); }
});

/* ---------------------------------------------------------------- sheets */

function openSheet(title, build) {
  commitEdit();
  $('sheet-title').textContent = title;
  const body = $('sheet-body');
  body.innerHTML = '';
  build(body);
  body.scrollTop = 0;
  $('sheet').hidden = $('backdrop').hidden = false;
}
function closeSheet() { $('sheet').hidden = $('backdrop').hidden = true; }
$('backdrop').onclick = $('sheet-close').onclick = closeSheet;

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

let emojiTab = Object.keys(EMOJI)[0];
$('btn-emoji').onclick = () => openSheet('Choose an emoji', body => {
  const { node } = find(selectedId);
  const tabs = h('div', { className: 'tabs' });
  const grid = h('div', { className: 'emoji-grid' });
  const pick = emoji => { change(() => { node.emoji = emoji; }); closeSheet(); };
  const show = name => {
    emojiTab = name;
    [...tabs.children].forEach(b => b.classList.toggle('on', b.textContent === name));
    grid.replaceChildren(...EMOJI[name].split(' ').map(e => h('button', { textContent: e, onclick: () => pick(e) })));
  };
  Object.keys(EMOJI).forEach(name => tabs.append(h('button', { textContent: name, onclick: () => show(name) })));
  body.append(tabs, grid);
  if (node.emoji) body.append(h('button', { className: 'pill-btn', textContent: `Remove ${node.emoji}`, onclick: () => pick('') }));
  show(emojiTab);
});

$('btn-color').onclick = () => openSheet('Branch color', body => {
  const { node } = find(selectedId);
  const current = pos.get(node.id).color;
  const sw = h('div', { className: 'swatches' });
  PALETTE.forEach(c => {
    const b = h('button', { className: c === current ? 'on' : '', onclick: () => { change(() => { node.color = c; }); closeSheet(); } });
    b.style.setProperty('--c', c);
    b.setAttribute('aria-label', 'Color ' + c);
    sw.append(b);
  });
  body.append(sw);
  if (node.color && find(node.id).parent && find(node.id).parent !== map.root) {
    body.append(h('button', { className: 'pill-btn', textContent: 'Match parent branch', onclick: () => { change(() => { delete node.color; }); closeSheet(); } }));
  }
});

function switchMap(id) {
  commitEdit();
  store.current = id;
  map = store.maps[id];
  selectedId = map.root.id;
  undoStack = []; redoStack = [];
  save();
  render();
  fit();
}

function mapsSheet() {
  openSheet('Mind maps', body => {
    Object.values(store.maps).sort((a, b) => b.updated - a.updated).forEach(m => {
      const row = h('div', { className: 'row' + (m.id === map.id ? ' on' : ''), onclick: () => { switchMap(m.id); closeSheet(); } },
        h('span', { className: 'em', textContent: m.root.emoji || '🗺️' }),
        h('span', { className: 'name' }, h('b', { textContent: m.root.text }), h('small', { textContent: `${count(m.root)} nodes` })));
      const del = h('button', { className: 'icon-btn', innerHTML: icon('trash') });
      del.setAttribute('aria-label', 'Delete map');
      del.onclick = e => {
        e.stopPropagation();
        if (!confirm(`Delete "${m.root.text}"? This can't be undone.`)) return;
        delete store.maps[m.id];
        if (!Object.keys(store.maps).length) { const s = starterMap(); store.maps[s.id] = s; }
        if (m.id === map.id) switchMap(Object.values(store.maps).sort((a, b) => b.updated - a.updated)[0].id);
        else save();
        mapsSheet();
      };
      row.append(del);
      body.append(row);
    });
    body.append(h('button', {
      className: 'pill-btn primary', textContent: 'New mind map', onclick: () => {
        const m = { id: uid(), root: mk('New map', '🌟'), updated: Date.now() };
        store.maps[m.id] = m;
        switchMap(m.id);
        closeSheet();
        startEdit(m.root.id, true);
      },
    }));
    body.append(h('div', { className: 'split' },
      h('button', { className: 'pill-btn', textContent: 'Export', onclick: exportMap }),
      h('button', { className: 'pill-btn', textContent: 'Import', onclick: () => $('file-input').click() })));
  });
}
$('btn-menu').onclick = mapsSheet;

async function exportMap() {
  const name = (map.root.text.replace(/[^\w\- ]+/g, '').trim() || 'mindmap') + '.json';
  const file = new File([JSON.stringify({ mindmap: 1, root: map.root }, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Rebuild imported data so only known fields survive and every node gets a fresh id. */
function sanitize(n, depth = 0) {
  if (!n || typeof n !== 'object' || depth > 200) throw new Error('bad node');
  const node = mk(String(n.text ?? '').slice(0, 500) || 'New idea', String(n.emoji ?? '').slice(0, 16));
  if (PALETTE.includes(n.color)) node.color = n.color;
  if (n.side === 'left' || n.side === 'right') node.side = n.side;
  if (n.collapsed) node.collapsed = true;
  node.children = (Array.isArray(n.children) ? n.children : []).map(c => sanitize(c, depth + 1));
  return node;
}

$('file-input').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const root = sanitize(data.root || data);
    root.children.forEach((c, i) => { c.color = c.color || PALETTE[i % PALETTE.length]; c.side = c.side || 'right'; });
    const m = { id: uid(), root, updated: Date.now() };
    store.maps[m.id] = m;
    switchMap(m.id);
    closeSheet();
  } catch (err) {
    alert("That file isn't a mind map exported from this app.");
  }
};

/* ------------------------------------------------------------------ boot */

function syncViewport() {
  const vv = window.visualViewport;
  document.documentElement.style.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');
  scrollTo(0, 0);
  if (editingId) reveal(editingId);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', syncViewport);
  visualViewport.addEventListener('scroll', syncViewport);
}
addEventListener('resize', syncViewport);
syncViewport();

render();
fit();
// Emoji and system fonts can finish loading after first paint and change node sizes.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); fit(); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
