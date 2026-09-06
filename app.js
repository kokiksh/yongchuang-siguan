/* 勇闯四关 — 一年级语文暑假作业 helper PWA */
(() => {
const D = window.DATA;
const KEY = 'ycsg-state-v1';
const $ = s => document.querySelector(s);
const app = $('#app');
const HAN = /[一-鿿]/;
const HANG = /[一-鿿]/g;

/* ---------- state ---------- */
const defaultState = () => ({
  preDone: 4,                       // 用紙にすでに書いてある行数
  entries: [],                      // {id, book, text, good:[], copied, ts}
  practiceBest: 0,
  poems: {},                        // id -> {level:0..3, mastered}
  lessons: {},                      // id -> {stars, best}
  wrong: {},                        // word -> count
  bonus: 0,
});
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return Object.assign(defaultState(), s); } catch (e) {} return defaultState(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} updateStars(); }

function stars() {
  let n = S.entries.length + S.entries.filter(e => e.copied).length;
  for (const p of Object.values(S.poems)) n += (p.level || 0) + (p.mastered ? 2 : 0);
  for (const l of Object.values(S.lessons)) n += l.stars || 0;
  n += (S.stories || []).length * 3 + (S.stories || []).filter(s => s.copied).length;
  n += S.practiceBest + S.bonus;
  return n;
}
function updateStars() { $('#star-count').textContent = stars(); }

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
function toast(msg, ms = 1600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
function crumb(t) { $('#crumb').textContent = t; }
function go(h) { location.hash = h; }

/* ---------- audio ---------- */
let AC;
function beep(seq) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    let t = AC.currentTime;
    for (const [f, d] of seq) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d); t += d * 0.9;
    }
  } catch (e) {}
}
const sfx = {
  ok: () => beep([[880, .12], [1320, .18]]),
  ng: () => beep([[220, .18], [180, .22]]),
  win: () => beep([[660, .12], [880, .12], [1100, .12], [1320, .3]]),
  tap: () => beep([[600, .06]]),
};

/* ---------- TTS ---------- */
const TTS = {
  voice: null,
  init() {
    if (!('speechSynthesis' in window)) return;
    const pickV = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find(v => /zh[-_]CN/i.test(v.lang) && /Tingting|Ting-Ting|Meijia|Lili|Yaoyao|Huihui/i.test(v.name))
        || vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    };
    pickV(); speechSynthesis.onvoiceschanged = pickV;
  },
  speak(text, rate = 0.8) {
    return new Promise(res => {
      if (!('speechSynthesis' in window)) { toast('这台设备不能朗读'); return res(); }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; if (this.voice) u.voice = this.voice; u.rate = rate; u.pitch = 1.05;
      u.onend = res; u.onerror = res;
      speechSynthesis.speak(u);
    });
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) {} }
};
TTS.init();

/* ---------- confetti ---------- */
function confetti(n = 140) {
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const cols = ['#FFC93C', '#FF6B6B', '#4CBB6C', '#1FA2D6', '#9B7BE0', '#F48FB1'];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 5 + Math.random() * 6, c: cols[Math.random() * cols.length | 0], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore(); }
    if (++frames < 170) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------- good words ---------- */
function findGood(text) {
  const found = new Set();
  for (const w of D.goodWords) if (text.includes(w)) found.add(w);
  const spans = [];
  const four = [
    /([一-鿿])\1([一-鿿])\2/g,                   // AABB
    /([一-鿿])([一-鿿])\1\2/g,                   // ABAB
    /([一-鿿])[一-鿿]\1[一-鿿]/g,        // ABAC
  ];
  const bad = /[的了是我你他她它们在和]/;
  for (const r of four) { let m; while ((m = r.exec(text))) { if (!bad.test(m[0])) { found.add(m[0]); spans.push([m.index, m.index + 4]); } } }
  const abb = /([一-鿿])([一-鿿])\2/g; let m;
  while ((m = abb.exec(text))) {
    const s = m.index, e = s + 3;
    if (bad.test(m[0])) continue;
    if (spans.some(([a, b]) => s < b && e > a)) continue;   // AABB の一部は除外
    found.add(m[0]);
  }
  return [...found];
}
function markGood(text, good) {
  let html = esc(text);
  for (const w of [...good].sort((a, b) => b.length - a.length)) html = html.split(esc(w)).join(`<u>${esc(w)}</u>`);
  return html;
}

/* ---------- gate progress ---------- */
const prog = {
  read() { const done = Math.min(D.totalRows, S.preDone + S.entries.length); return { done, total: D.totalRows }; },
  poems() { const done = D.poems.filter(p => S.poems[p.id]?.mastered).length; return { done, total: D.poems.length }; },
  dict() { const done = D.lessons.filter(l => (S.lessons[l.id]?.stars || 0) > 0).length + ((S.lessons.boss?.stars || 0) > 0 ? 1 : 0); return { done, total: D.lessons.length + 1 }; },
};

/* ---------- views ---------- */
const V = {};

V.home = () => {
  crumb('勇闯四关');
  const r = prog.read(), p = prog.poems(), d = prog.dict();
  const pct = x => Math.round(100 * x.done / x.total);
  const all = r.done >= r.total && p.done >= p.total && d.done >= d.total;
  app.innerHTML = `
  <div class="island"><div class="sunball"></div>
    <h1>🏝️ 勇闯四关</h1>
    <div class="sub">yǒng chuǎng sì guān · 一年级语文暑假作业</div>
    <div class="sub" style="margin-top:8px">${all ? '🎉 四关全部通过！你太棒了！' : '每天闯一点，星星越来越多 ⭐'}</div>
  </div>
  <div class="gates">
    <button class="gate" onclick="location.hash='read'">
      ${r.done >= r.total ? '<span class="done">通关!</span>' : ''}
      <div class="ico">📚</div><div class="name">第一关 畅游书海</div><div class="py">chàng yóu shū hǎi · 读书记录</div>
      <div class="bar"><i style="width:${pct(r)}%"></i></div><div class="stat">已经写了 ${r.done} / ${r.total} 句</div>
    </button>
    <button class="gate" onclick="location.hash='poems'">
      ${p.done >= p.total ? '<span class="done">通关!</span>' : ''}
      <div class="ico">📜</div><div class="name">第二关 吟诗作对</div><div class="py">yín shī zuò duì · 背古诗</div>
      <div class="bar sun"><i style="width:${pct(p)}%"></i></div><div class="stat">背会了 ${p.done} / ${p.total} 首</div>
    </button>
    <button class="gate" onclick="location.hash='dict'">
      ${d.done >= d.total ? '<span class="done">通关!</span>' : ''}
      <div class="ico">✏️</div><div class="name">第三关 复习巩固</div><div class="py">fù xí gǒng gù · 听写词语</div>
      <div class="bar coral"><i style="width:${pct(d)}%"></i></div><div class="stat">练过 ${d.done} / ${d.total} 课</div>
    </button>
    <button class="gate" onclick="location.hash='write'">
      ${(S.stories || []).length ? '<span class="done">通关!</span>' : ''}
      <div class="ico">🐵</div><div class="name">第四关 妙笔生花</div><div class="py">miào bǐ shēng huā · 小猴子学飞</div>
      <div class="bar purple"><i style="width:${Math.min(100, (S.stories || []).length * 50)}%"></i></div><div class="stat">${(S.stories || []).length ? `写了 ${(S.stories || []).length} 个故事 ✍️` : '再写一个更棒的故事吧！'}</div>
    </button>
  </div>
  <div class="center" style="margin-top:18px"><button class="btn ghost sm" onclick="location.hash='parent'">👨‍👩‍👧 家长看这里</button></div>`;
};

/* ===== 第一关 读书记录 ===== */
V.read = () => {
  crumb('第一关 畅游书海');
  const r = prog.read();
  const slots = D.animals.map((a, i) => {
    const cls = i < S.preDone ? 'pre' : (i < S.preDone + S.entries.length ? 'done' : 'todo');
    return `<div class="slot ${cls}">${a}</div>`;
  }).join('');
  const list = S.entries.slice().reverse().map(e => `
    <div class="card entry ${e.copied ? 'copied' : ''}">
      <div class="ani">${D.animals[Math.min(D.totalRows - 1, S.preDone + S.entries.indexOf(e))]}</div>
      <div style="flex:1">
        <div class="book">《${esc(e.book)}》</div>
        <div class="txt">${markGood(e.text, e.good)}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm ghost" data-say="${esc(e.text)}">🔊 读一读</button>
          <button class="btn sm ${e.copied ? 'leaf' : 'sun'}" data-copy="${e.id}">${e.copied ? '✅ 抄到纸上了' : '📝 看大字，抄到纸上'}</button>
          <button class="btn sm ghost" data-del="${e.id}">🗑</button>
        </div>
      </div>
    </div>`).join('');
  app.innerHTML = `
    <div class="card">
      <div class="row spread"><h1 style="margin:0">📚 读书记录</h1><div class="sub">${r.done} / ${r.total}</div></div>
      <div class="sub">读一本书，找一句好句子，把里面的<b style="color:#B23A3A">好词</b>画出来。</div>
      <div class="rows-grid" style="margin-top:12px">${slots}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn big leaf" onclick="location.hash='read/new'">✍️ 写一句新的</button>
        <button class="btn sun" onclick="location.hash='read/practice'">🔎 找好词游戏</button>
      </div>
    </div>
    ${list || '<div class="card center sub">还没有句子，点「写一句新的」开始吧！</div>'}`;
  app.querySelectorAll('[data-say]').forEach(b => b.onclick = () => TTS.speak(b.dataset.say));
  app.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => go('read/card/' + b.dataset.copy));
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('删掉这一句吗？')) { S.entries = S.entries.filter(e => e.id !== b.dataset.del); save(); V.read(); } });
};

V['read/new'] = () => {
  crumb('写一句新的');
  let book = '', text = '', good = new Set(), manual = new Set();
  app.innerHTML = `
    <div class="card">
      <h2>1️⃣ 你读的是哪本书？</h2>
      <div class="chips" id="books">${D.books.map(b => `<button class="chip" data-b="${esc(b.t)}">${b.e} ${esc(b.t)}</button>`).join('')}</div>
      <input class="text" id="bookname" placeholder="或者自己写书名…" style="margin-top:10px">
    </div>
    <div class="card">
      <h2>2️⃣ 把喜欢的句子打出来</h2>
      <div class="sub">用拼音键盘打字，打完点 🔊 听一听对不对。</div>
      <textarea class="sentence" id="sent" placeholder="例：天是蓝湛湛的，树是绿莹莹的。"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn sm ghost" id="say">🔊 读一读</button></div>
    </div>
    <div class="card">
      <h2>3️⃣ 哪些是好词？</h2>
      <div class="sub">点一下，选出这句话里最漂亮的词（可以选好几个）。</div>
      <div class="preview" id="prev"></div>
      <div class="chips" id="cands"></div>
      <div class="row" style="margin-top:10px"><input class="text" id="addgood" placeholder="自己加一个好词" style="flex:1"><button class="btn sm ghost" id="addbtn">➕</button></div>
    </div>
    <button class="btn big block leaf" id="savebtn" disabled>💾 保存，收下这只小动物！</button>
    <div style="height:30px"></div>`;
  const prev = $('#prev'), cands = $('#cands'), sent = $('#sent'), bookIn = $('#bookname');
  function refresh() {
    text = sent.value.trim();
    const auto = findGood(text);
    const all = [...new Set([...auto, ...manual])].filter(w => text.includes(w));
    for (const g of [...good]) if (!text.includes(g)) good.delete(g);
    cands.innerHTML = all.map(w => `<button class="chip ${good.has(w) ? 'good' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('') || '<span class="sub">还没发现好词，试试「绿油油」「五颜六色」这样的词～</span>';
    cands.querySelectorAll('[data-w]').forEach(c => c.onclick = () => { sfx.tap(); good.has(c.dataset.w) ? good.delete(c.dataset.w) : good.add(c.dataset.w); refresh(); });
    prev.innerHTML = markGood(text, good);
    $('#savebtn').disabled = !(book && text.length >= 2);
  }
  $('#books').querySelectorAll('.chip').forEach(c => c.onclick = () => { $('#books').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); book = c.dataset.b; bookIn.value = ''; sfx.tap(); refresh(); });
  bookIn.oninput = () => { book = bookIn.value.trim(); $('#books').querySelectorAll('.chip').forEach(x => x.classList.remove('on')); refresh(); };
  sent.oninput = refresh;
  $('#say').onclick = () => TTS.speak(sent.value.trim());
  $('#addbtn').onclick = () => { const w = $('#addgood').value.trim(); if (!w) return; if (!sent.value.includes(w)) { toast('句子里没有这个词哦'); return; } manual.add(w); good.add(w); $('#addgood').value = ''; refresh(); };
  $('#savebtn').onclick = () => {
    const e = { id: Date.now().toString(36), book, text, good: [...good], copied: false, ts: Date.now() };
    S.entries.push(e); save(); sfx.win(); confetti(80);
    go('read/card/' + e.id);
  };
};

V['read/card'] = id => {
  const e = S.entries.find(x => x.id === id); if (!e) return go('read');
  crumb('抄到纸上');
  const idx = S.entries.indexOf(e);
  app.innerHTML = `
    <div class="card center"><div style="font-size:72px" class="pop">${D.animals[Math.min(D.totalRows - 1, S.preDone + idx)]}</div>
      <div class="sub">第 ${S.preDone + idx + 1} 行 · 用铅笔，把下面的句子抄到作业纸上，好词下面画横线。</div></div>
    <div class="copycard">
      <div class="small" style="font-size:20px;color:#8a7a4a">书名：《${esc(e.book)}》</div>
      <div>${markGood(e.text, e.good)}</div>
    </div>
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" id="say">🔊 读一读</button>
      <button class="btn big ${e.copied ? 'leaf' : 'sun'}" id="done">${e.copied ? '✅ 已经抄好了' : '✅ 我抄好了！'}</button>
      <button class="btn ghost" onclick="location.hash='read'">← 返回</button>
    </div>`;
  $('#say').onclick = () => TTS.speak(e.text);
  $('#done').onclick = () => { if (!e.copied) { e.copied = true; save(); sfx.win(); confetti(120); toast('太棒了！又完成一行 ⭐'); } setTimeout(() => go('read'), 700); };
};

V['read/practice'] = () => {
  crumb('找好词游戏');
  const qs = pick(D.practice, 8); let i = 0, score = 0;
  function show() {
    if (i >= qs.length) {
      const st = score >= 8 ? 3 : score >= 6 ? 2 : 1;
      if (st > S.practiceBest) { S.practiceBest = st; save(); }
      sfx.win(); confetti();
      app.innerHTML = `<div class="card result"><div class="big">🔎</div><div class="stars">${'⭐'.repeat(st)}</div><div>答对 ${score} / ${qs.length} 题</div>
        <div class="row" style="justify-content:center;margin-top:16px"><button class="btn sun" onclick="location.hash='read/practice'">再玩一次</button><button class="btn ghost" onclick="location.hash='read'">返回</button></div></div>`;
      return;
    }
    const q = qs[i]; let locked = false;
    app.innerHTML = `<div class="card center"><div class="sub">第 ${i + 1} / ${qs.length} 题 · 答对 ${score}</div>
      <h2>哪个是好词？点一下！</h2>
      <div class="tokens" id="tk">${q.tk.map((t, k) => `<span class="tk ${HAN.test(t) && t.length >= 2 ? 'pickable' : ''}" data-k="${k}">${esc(t)}</span>`).join('')}</div>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn ghost sm" id="say">🔊 读一读</button></div></div>`;
    $('#say').onclick = () => TTS.speak(q.tk.join(''));
    app.querySelectorAll('.tk.pickable').forEach(el => el.onclick = () => {
      if (locked) return;
      const t = q.tk[+el.dataset.k];
      if (t === q.a) { locked = true; el.classList.add('right'); sfx.ok(); score++; setTimeout(() => { i++; show(); }, 700); }
      else { el.classList.add('wrong'); sfx.ng(); setTimeout(() => el.classList.remove('wrong'), 400); }
    });
  }
  show();
};

/* ===== 第二关 古诗 ===== */
function poemState(id) { return S.poems[id] || (S.poems[id] = { level: 0, mastered: false }); }
function rubyLine(line) {
  const syl = line.p.trim().split(/\s+/); let k = 0;
  return [...line.t].map(ch => HAN.test(ch) ? `<ruby>${ch}<rt>${syl[k++] || ''}</rt></ruby>` : `<span>${ch}</span>`).join('');
}

V.poems = () => {
  crumb('第二关 吟诗作对');
  const p = prog.poems();
  const book = pm => { const st = poemState(pm.id); const lv = st.mastered ? 3 : st.level; return `<button class="book l${lv}" onclick="location.hash='poem/${pm.id}'">${esc(pm.t)}<span class="lvl">${st.mastered ? '🌟' : lv ? '⭐'.repeat(lv) : ''}</span></button>`; };
  app.innerHTML = `
    <div class="card"><div class="row spread"><h1 style="margin:0">📜 我的古诗书架</h1><div class="sub">${p.done} / ${p.total}</div></div>
      <div class="sub">每背会一首，书就会变成彩色的。三关都过，书变成 🌟 粉红色！</div></div>
    <div class="shelf"><div class="books">${D.poems.filter(x => x.shelf === 1).map(book).join('')}</div></div>
    <div class="shelf"><div class="books">${D.poems.filter(x => x.shelf === 2).map(book).join('')}</div></div>`;
};

V.poem = (id, mode) => {
  const pm = D.poems.find(x => x.id === id); if (!pm) return go('poems');
  const st = poemState(id);
  crumb(pm.t);
  if (!mode || mode === 'read') return poemRead(pm, st);
  if (mode === 'q1') return poemQuiz(pm, st, 1);
  if (mode === 'q2') return poemQuiz(pm, st, 2);
  if (mode === 'recite') return poemRecite(pm, st);
};

function poemRead(pm, st) {
  app.innerHTML = `
    <div class="card poem">
      <h1 style="margin:0">${esc(pm.t)}</h1><div class="sub">${esc(pm.a)}${pm.note ? ' · ' + esc(pm.note) : ''}</div>
      <div id="lines" style="margin-top:10px">${pm.lines.map((l, i) => `<div class="line tap" data-i="${i}">${rubyLine(l)}</div>`).join('')}</div>
      <div class="sub">点一行，就会读那一行。</div>
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="playall">🔊 全部读一遍</button></div>
    </div>
    <div class="card">
      <h2>闯关 ${st.mastered ? '🌟 已经背会了！' : ''}</h2>
      <div class="row">
        <button class="btn sun" onclick="location.hash='poem/${pm.id}/q1'">${st.level >= 1 ? '⭐' : '1️⃣'} 填空 · 简单</button>
        <button class="btn coral" onclick="location.hash='poem/${pm.id}/q2'" ${st.level < 1 ? 'disabled' : ''}>${st.level >= 2 ? '⭐' : '2️⃣'} 填空 · 困难</button>
        <button class="btn purple" onclick="location.hash='poem/${pm.id}/recite'" ${st.level < 2 ? 'disabled' : ''}>${st.mastered ? '🌟' : '3️⃣'} 背给我听</button>
      </div>
      <div class="sub" style="margin-top:8px">先跟着读几遍，再一关一关闯。</div>
    </div>
    <button class="btn ghost" onclick="location.hash='poems'">← 回到书架</button>`;
  app.querySelectorAll('.line').forEach(el => el.onclick = async () => { hl(+el.dataset.i); await TTS.speak(pm.lines[+el.dataset.i].t, 0.75); hl(-1); });
  function hl(i) { app.querySelectorAll('.line').forEach((el, k) => el.classList.toggle('playing', k === i)); }
  $('#playall').onclick = async () => { for (let i = 0; i < pm.lines.length; i++) { hl(i); await TTS.speak(pm.lines[i].t, 0.75); } hl(-1); };
}

function poemQuiz(pm, st, level) {
  // build blanks
  const lines = pm.lines.map(l => {
    const chars = [...l.t]; const hanIdx = chars.map((c, i) => HAN.test(c) ? i : -1).filter(i => i >= 0);
    const nBlank = level === 1 ? 1 : Math.ceil(hanIdx.length / 2);
    const blanks = new Set(pick(hanIdx, nBlank));
    return { chars, blanks };
  });
  const allHan = [...new Set(pm.lines.flatMap(l => l.t.match(HANG) || []))];
  const queue = []; lines.forEach((l, li) => [...l.blanks].sort((a, b) => a - b).forEach(ci => queue.push({ li, ci, ch: l.chars[ci] })));
  let qi = 0, mistakes = 0;
  function render() {
    const cur = queue[qi];
    app.innerHTML = `
      <div class="card poem"><div class="sub">${esc(pm.t)} · 填空${level === 1 ? '简单' : '困难'} · 错了 ${mistakes} 次</div>
        <div style="margin-top:10px">${lines.map((l, li) => `<div class="line">${l.chars.map((c, ci) => {
          if (!l.blanks.has(ci)) return `<span>${c}</span>`;
          const k = queue.findIndex(q => q.li === li && q.ci === ci);
          if (k < qi) return `<span class="blank filled">${c}</span>`;
          return `<span class="blank ${k === qi ? 'cur' : ''}">${c}</span>`;
        }).join('')}</div>`).join('')}</div>
        <div class="sub">红框里应该是哪个字？</div>
        <div class="choices" id="ch"></div>
        <div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost sm" id="hint">🔊 听这一句</button></div>
      </div>`;
    if (!cur) return;
    const opts = shuffle([cur.ch, ...pick(allHan.filter(c => c !== cur.ch), 2)]);
    $('#ch').innerHTML = opts.map(o => `<button class="btn ghost" data-c="${o}">${o}</button>`).join('');
    $('#ch').querySelectorAll('button').forEach(b => b.onclick = () => {
      if (b.dataset.c === cur.ch) { sfx.ok(); qi++; if (qi >= queue.length) finish(); else render(); }
      else { sfx.ng(); mistakes++; b.classList.add('pop'); b.style.opacity = .3; b.disabled = true; app.querySelector('.sub').textContent = `${pm.t} · 填空${level === 1 ? '简单' : '困难'} · 错了 ${mistakes} 次`; }
    });
    $('#hint').onclick = () => TTS.speak(pm.lines[cur.li].t, 0.75);
  }
  function finish() {
    const pass = mistakes <= Math.max(2, Math.floor(queue.length / 4));
    if (pass && st.level < level) { st.level = level; save(); }
    if (pass) { sfx.win(); confetti(); }
    else sfx.ng();
    app.innerHTML = `<div class="card result"><div class="big">${pass ? '🎉' : '💪'}</div>
      <h2>${pass ? '过关了！' : '再试一次就会更好！'}</h2><div class="sub">错了 ${mistakes} 次</div>
      <div class="row" style="justify-content:center;margin-top:16px">
        ${pass && level === 1 ? `<button class="btn coral" onclick="location.hash='poem/${pm.id}/q2'">➡️ 填空 · 困难</button>` : ''}
        ${pass && level === 2 ? `<button class="btn purple" onclick="location.hash='poem/${pm.id}/recite'">➡️ 背给我听</button>` : ''}
        <button class="btn sun" onclick="location.hash='poem/${pm.id}/q${level}'">再来一次</button>
        <button class="btn ghost" onclick="location.hash='poem/${pm.id}'">返回</button></div></div>`;
  }
  render();
}

function poemRecite(pm, st) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let revealed = new Set();
  function render() {
    app.innerHTML = `
      <div class="card poem"><h2 style="margin:0">${esc(pm.t)} · 背给我听</h2>
        <div class="sub">只看开头的字，大声背出来。背出一行，就点那一行看看对不对。</div>
        <div style="margin-top:10px">${pm.lines.map((l, i) => revealed.has(i)
          ? `<div class="line">${esc(l.t)}</div>`
          : `<div class="hidden-line tap" data-i="${i}">${[...l.t].map((c, k) => HAN.test(c) ? (k === 0 ? c : '<i class="hid"></i>') : c).join('')}</div>`).join('')}</div>
        ${SR ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn purple big" id="mic">🎤 念给我听，我来检查</button></div><div class="mic-out" id="out" style="margin-top:10px;display:none"></div>` : ''}
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn leaf big" id="ok">${st.mastered ? '🌟 已经背会了' : '🌟 我全部背出来了！'}</button>
        <button class="btn ghost" onclick="location.hash='poem/${pm.id}'">返回</button>
      </div>
      <div class="sub center" style="margin-top:10px">背给爸爸妈妈听，他们说对了再点 🌟 哦。</div>`;
    app.querySelectorAll('.hidden-line').forEach(el => el.onclick = () => { revealed.add(+el.dataset.i); sfx.tap(); render(); });
    $('#ok').onclick = () => { if (!st.mastered) { st.mastered = true; st.level = Math.max(st.level, 2); save(); sfx.win(); confetti(200); toast('书架上的书变彩色了！'); } setTimeout(() => go('poems'), 900); };
    if (SR) $('#mic').onclick = () => listen();
  }
  function listen() {
    const rec = new SR(); rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    const out = $('#out'); out.style.display = 'block'; out.textContent = '🎤 在听…背完了再点一下停止'; $('#mic').textContent = '⏹ 停止';
    let text = '';
    rec.onresult = ev => { text = ''; for (const r of ev.results) text += r[0].transcript; out.textContent = text; };
    rec.onerror = () => { out.textContent = '没听清楚，再试一次～'; $('#mic').textContent = '🎤 念给我听，我来检查'; };
    rec.onend = () => {
      $('#mic').textContent = '🎤 念给我听，我来检查'; $('#mic').onclick = () => listen();
      if (!text) return;
      const target = pm.lines.map(l => l.t).join('').match(HANG) || [];
      const heard = (text.match(HANG) || []);
      const hit = target.filter(c => heard.includes(c)).length; const ratio = hit / target.length;
      out.innerHTML = `${esc(text)}<br><b>${Math.round(ratio * 100)}% 对了 ${ratio >= 0.7 ? '🎉 很棒！' : '💪 再练练'}</b>`;
      if (ratio >= 0.7) { sfx.win(); confetti(); revealed = new Set(pm.lines.map((_, i) => i)); setTimeout(render, 2500); } else sfx.ng();
    };
    $('#mic').onclick = () => rec.stop();
    try { rec.start(); } catch (e) { out.textContent = '这台设备不能听写'; }
  }
  render();
}

/* ===== 第三关 听写 ===== */
V.dict = () => {
  crumb('第三关 复习巩固');
  const d = prog.dict();
  const boss = S.lessons.boss || {};
  const wrongN = Object.keys(S.wrong).length;
  app.innerHTML = `
    <div class="card"><div class="row spread"><h1 style="margin:0">✏️ 听写词语</h1><div class="sub">${d.done} / ${d.total}</div></div>
      <div class="sub">听一听，写在纸上或者屏幕上，再看答案。全对得 ⭐⭐⭐。</div></div>
    <div class="lesson-grid">
      <button class="lesson boss" onclick="location.hash='dict/boss'"><div class="t">👑 大魔王 · 容易错的 ${D.boss.length} 个词</div><div class="s">${'⭐'.repeat(boss.stars || 0)}</div><div class="n">作业纸上圈起来的词</div></button>
      ${wrongN ? `<button class="lesson" style="background:#FFF1F1" onclick="location.hash='dict/wrong'"><div class="t">📕 错题本</div><div class="s">${wrongN} 个词</div><div class="n">练到全对就消失</div></button>` : ''}
      ${D.lessons.map(l => { const s = S.lessons[l.id] || {}; return `<button class="lesson" onclick="location.hash='dict/${l.id}'"><div class="t">${esc(l.t)}</div><div class="s">${'⭐'.repeat(s.stars || 0)}</div><div class="n">${l.w.length} 个词</div></button>`; }).join('')}
    </div>`;
};

V['dict'] = V.dict;
V.dictRun = id => {
  let words, title;
  if (id === 'boss') { words = D.boss; title = '👑 大魔王'; }
  else if (id === 'wrong') { words = Object.keys(S.wrong); title = '📕 错题本'; }
  else { const l = D.lessons.find(x => x.id === id); if (!l) return go('dict'); words = l.w; title = l.t; }
  if (!words.length) return go('dict');
  crumb(title);
  const order = shuffle(words); let i = 0; const results = []; let revealed = false;
  function render() {
    const w = order[i];
    app.innerHTML = `
      <div class="card">
        <div class="row spread"><div class="sub">${esc(title)} · 第 ${i + 1} / ${order.length} 个</div>
          <div class="progress-dots">${order.map((_, k) => `<i class="${k < i ? (results[k] ? 'ok' : 'ng') : k === i ? 'cur' : ''}"></i>`).join('')}</div></div>
        <div class="row" style="justify-content:center;margin:14px 0"><button class="btn big" id="play">🔊 再听一遍</button></div>
        <div class="pad-wrap"><canvas class="pad" id="pad"></canvas><div class="answer" id="ans" style="display:none">${esc(w)}</div></div>
        <div class="row spread" style="margin-top:10px">
          <button class="btn ghost sm" id="clear">🧹 擦掉</button>
          <div id="actions"><button class="btn sun" id="reveal">👀 看答案</button></div>
        </div>
      </div>
      <button class="btn ghost sm" onclick="location.hash='dict'">← 放弃这次</button>`;
    setupPad($('#pad'));
    revealed = false;
    $('#play').onclick = () => TTS.speak(w, 0.7);
    $('#clear').onclick = () => setupPad($('#pad'), true);
    $('#reveal').onclick = () => { revealed = true; $('#ans').style.display = 'grid'; $('#actions').innerHTML = `<button class="btn leaf" id="yes">✅ 写对了</button> <button class="btn coral" id="no">❌ 写错了</button>`; $('#yes').onclick = () => mark(true); $('#no').onclick = () => mark(false); };
    setTimeout(() => TTS.speak(w, 0.7), 300);
  }
  function mark(ok) {
    const w = order[i]; results[i] = ok;
    if (ok) { sfx.ok(); if (S.wrong[w]) { S.wrong[w]--; if (S.wrong[w] <= 0) delete S.wrong[w]; } }
    else { sfx.ng(); S.wrong[w] = (S.wrong[w] || 0) + 1; }
    save(); i++;
    if (i >= order.length) finish(); else render();
  }
  function finish() {
    const okN = results.filter(Boolean).length, ratio = okN / order.length;
    const st = ratio === 1 ? 3 : ratio >= 0.8 ? 2 : 1;
    if (id !== 'wrong') { const rec = S.lessons[id] || (S.lessons[id] = { stars: 0, best: 0 }); rec.stars = Math.max(rec.stars, st); rec.best = Math.max(rec.best, okN); save(); }
    if (st === 3) { sfx.win(); confetti(); } else sfx.ok();
    const wrongs = order.filter((_, k) => !results[k]);
    app.innerHTML = `<div class="card result"><div class="big">${st === 3 ? '🏆' : st === 2 ? '😊' : '💪'}</div>
      <div class="stars">${'⭐'.repeat(st)}</div><div>写对 ${okN} / ${order.length} 个</div>
      ${wrongs.length ? `<div class="bigword" style="margin-top:14px;font-size:36px;color:#B23A3A">${wrongs.map(esc).join('　')}</div><div class="sub">这些词再写三遍吧！</div>` : '<div class="sub" style="margin-top:10px">全对！太厉害了！</div>'}
      <div class="row" style="justify-content:center;margin-top:16px">
        ${wrongs.length ? `<button class="btn coral" id="retry">✏️ 只练错的</button>` : ''}
        <button class="btn sun" onclick="location.hash='dict/${id}'">再来一次</button>
        <button class="btn ghost" onclick="location.hash='dict'">返回</button></div></div>`;
    if (wrongs.length) $('#retry').onclick = () => { order.splice(0, order.length, ...shuffle(wrongs)); results.length = 0; i = 0; render(); };
  }
  render();
};

function setupPad(c, clearOnly) {
  const dpr = devicePixelRatio || 1; const rect = c.getBoundingClientRect();
  c.width = rect.width * dpr; c.height = rect.height * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#23343F';
  if (clearOnly) return;
  let drawing = false, last = null;
  const pos = ev => { const r = c.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  c.onpointerdown = ev => { drawing = true; last = pos(ev); c.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, 7); ctx.fill(); };
  c.onpointermove = ev => { if (!drawing) return; const p = pos(ev); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
  c.onpointerup = c.onpointercancel = () => { drawing = false; };
}

/* ===== 第四关 妙笔生花 ===== */
const OLD_STORY = '一天，小猴在树下玩。这时，一只老鹰飞了过来。小猴想：“要是我能飞，该多好啊！”于是，小猴爬上了树，然后跳了下来。结果摔了下来，四脚朝天。哈哈哈哈哈！';
const STEPS = [
  { pre: '一天，小猴在', post: '。', q: '什么时间？小猴在哪里，怎么样地做什么？', ph: '树下高高兴兴地玩', hints: ['树下', '草地上', '山坡上', '高高兴兴地', '自由自在地', '玩耍', '晒太阳', '吃香蕉', '荡秋千'] },
  { pre: '这时，老鹰', post: '。', q: '老鹰在做什么？', ph: '在天空中自由自在地飞翔', hints: ['在天空中', '自由自在地', '飞翔', '展开翅膀', '飞了过来', '又高又快', '一只', '大大的'] },
  { pre: '小猴想：“', post: '”', q: '小猴看到老鹰，心里会想什么？', ph: '要是我也能飞，该多好啊！', hints: ['要是我也能飞，该多好啊！', '我也想飞上蓝天！', '真羡慕啊！', '飞起来一定很好玩！', '我一定也可以！'] },
  { pre: '于是，小猴', post: '，', q: '小猴怎么做？', ph: '爬上大树，张开双手用力一跳', hints: ['爬上大树', '张开双手', '用力一跳', '学着老鹰的样子', '扑腾扑腾', '闭上眼睛', '大喊一声'] },
  { pre: '结果', post: '。', q: '结果怎样？', ph: '摔了下来，四脚朝天', hints: ['摔了下来', '四脚朝天', '屁股摔得好疼', '哇哇大哭', '哈哈大笑', '明白了：猴子是不会飞的', '下次再也不学飞了'] },
];
function joinPart(step, t) {
  t = (t || '').trim().replace(/[。！？，、”]+$/, m => (step.post === '”' ? m.replace(/”/g, '') : ''));
  if (step.post === '”' && !/[。！？]$/.test(t)) t += '！';
  return step.pre + t + step.post;
}
function assemble(parts) { return STEPS.map((s, i) => joinPart(s, parts[i])).join(''); }
function gridPaper(text) {
  return `<div class="paper">${[...text].map(c => `<span class="cell">${esc(c)}</span>`).join('')}</div>`;
}

V.write = () => {
  crumb('第四关 妙笔生花');
  const stories = S.stories || [];
  app.innerHTML = `
    <div class="card">
      <div class="row spread"><h1 style="margin:0">🐵 小猴子学飞</h1><div class="sub">写了 ${stories.length} 个故事</div></div>
      <img class="comic" src="./comic.jpg" alt="小猴子学飞 三幅图">
      <div class="sub">仔细看图，想一想：什么时间，谁在哪里怎么样地做什么？小猴子看到老鹰会想什么？怎么做？结果怎样？</div>
      <div class="row" style="margin-top:14px">
        <button class="btn big leaf" onclick="location.hash='write/new'">✍️ 写一个新故事</button>
        <button class="btn ghost" id="old">📄 看看以前写的</button>
      </div>
      <div id="oldbox" style="display:none;margin-top:12px"><div class="sub">这是你 9 月交给老师的那个故事：</div>${gridPaper(OLD_STORY)}<button class="btn sm ghost" style="margin-top:8px" id="sayold">🔊 读一读</button></div>
    </div>
    ${stories.slice().reverse().map(st => `
      <div class="card">
        <div class="row spread"><b>📖 故事 ${stories.indexOf(st) + 1}</b><span class="small">${new Date(st.ts).toLocaleDateString('zh-CN')}</span></div>
        ${gridPaper(st.text)}
        <div class="row" style="margin-top:10px">
          <button class="btn sm ghost" data-say="${esc(st.text)}">🔊 读一读</button>
          <button class="btn sm ${st.copied ? 'leaf' : 'sun'}" data-copy="${st.id}">${st.copied ? '✅ 抄到纸上了' : '📝 我抄到纸上了'}</button>
          <button class="btn sm ghost" data-del="${st.id}">🗑</button>
        </div>
      </div>`).join('')}
    <button class="btn ghost" onclick="location.hash='home'">← 返回</button>`;
  $('#old').onclick = () => { const b = $('#oldbox'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; };
  $('#sayold').onclick = () => TTS.speak(OLD_STORY, 0.85);
  app.querySelectorAll('[data-say]').forEach(b => b.onclick = () => TTS.speak(b.dataset.say, 0.85));
  app.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { const st = stories.find(x => x.id === b.dataset.copy); if (st && !st.copied) { st.copied = true; save(); sfx.win(); confetti(120); } V.write(); });
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('删掉这个故事吗？')) { S.stories = stories.filter(x => x.id !== b.dataset.del); save(); V.write(); } });
};

V['write/new'] = () => {
  crumb('写故事');
  const parts = ['', '', '', '', ''];
  let step = 0;
  function render() {
    const s = STEPS[step];
    app.innerHTML = `
      <div class="card">
        <div class="row spread"><div class="sub">第 ${step + 1} / ${STEPS.length} 步</div>
          <div class="progress-dots">${STEPS.map((_, k) => `<i class="${k < step ? 'ok' : k === step ? 'cur' : ''}"></i>`).join('')}</div></div>
        <img class="comic" src="./comic.jpg" alt="">
        <h2>${esc(s.q)}</h2>
        <div class="story-line"><span class="fixed">${esc(s.pre)}</span><textarea class="sentence inline" id="part" placeholder="${esc(s.ph)}">${esc(parts[step])}</textarea><span class="fixed">${esc(s.post)}</span></div>
        <div class="sub">可以自己打字，也可以点下面的词加进去。</div>
        <div class="chips" id="hints">${s.hints.map(h => `<button class="chip" data-h="${esc(h)}">${esc(h)}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn sm ghost" id="say">🔊 读一读这句</button><button class="btn sm ghost" id="clear">🧹 清空</button></div>
      </div>
      <div class="card"><div class="sub">目前的故事：</div><div class="story-preview" id="prev"></div></div>
      <div class="row spread">
        <button class="btn ghost" id="back">${step === 0 ? '← 返回' : '← 上一步'}</button>
        <button class="btn big ${step === STEPS.length - 1 ? 'leaf' : ''}" id="next">${step === STEPS.length - 1 ? '🎉 故事写好了！' : '下一步 →'}</button>
      </div>`;
    const ta = $('#part');
    const upd = () => { parts[step] = ta.value; $('#prev').textContent = STEPS.slice(0, step + 1).map((st, i) => (parts[i] || i === step) ? joinPart(st, parts[i]) : '').join(''); $('#next').disabled = !ta.value.trim(); };
    ta.oninput = upd; upd();
    $('#hints').querySelectorAll('.chip').forEach(c => c.onclick = () => { sfx.tap(); ta.value = (ta.value.trim() + c.dataset.h); upd(); });
    $('#say').onclick = () => TTS.speak(joinPart(s, ta.value), 0.85);
    $('#clear').onclick = () => { ta.value = ''; upd(); };
    $('#back').onclick = () => { if (step === 0) go('write'); else { step--; render(); } };
    $('#next').onclick = () => {
      if (!ta.value.trim()) return;
      if (step < STEPS.length - 1) { step++; render(); }
      else {
        const text = assemble(parts);
        S.stories = S.stories || []; S.stories.push({ id: Date.now().toString(36), parts: parts.slice(), text, copied: false, ts: Date.now() });
        save(); sfx.win(); confetti(200);
        app.innerHTML = `<div class="card result"><div class="big">🐵🎉</div><h2>你的故事写好了！</h2>${gridPaper(text)}
          <div class="sub" style="margin-top:8px">用铅笔抄到作文格子里，每个格子写一个字。</div>
          <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="say2">🔊 读一读</button><button class="btn sun" onclick="location.hash='write'">看我的故事</button></div></div>`;
        $('#say2').onclick = () => TTS.speak(text, 0.85);
      }
    };
  }
  render();
};

/* ===== 家长 ===== */
V.parent = () => {
  crumb('家长');
  const r = prog.read(), p = prog.poems(), d = prog.dict();
  const toCopy = S.entries.filter(e => !e.copied);
  app.innerHTML = `
    <div class="card"><h1 style="margin:0 0 8px">👨‍👩‍👧 家长页</h1>
      <div class="parent-row"><span>第一关 读书记录</span><b>${r.done} / ${r.total} 行（纸上已有 ${S.preDone} 行）</b></div>
      <div class="parent-row"><span>第二关 背古诗</span><b>${p.done} / ${p.total} 首</b></div>
      <div class="parent-row"><span>第三关 听写</span><b>${d.done} / ${d.total} 课 · 错题 ${Object.keys(S.wrong).length} 个</b></div>
      <div class="parent-row"><span>总星星</span><b>⭐ ${stars()}</b></div>
    </div>
    <div class="card"><h2>还没抄到纸上的句子（${toCopy.length}）</h2>
      <ul class="list">${toCopy.map(e => `<li>《${esc(e.book)}》 ${markGood(e.text, e.good)}</li>`).join('') || '<li class="small">没有</li>'}</ul></div>
    <div class="card"><h2>错题本</h2><div class="chips">${Object.entries(S.wrong).map(([w, n]) => `<span class="chip good">${esc(w)} ×${n}</span>`).join('') || '<span class="small">没有错题</span>'}</div></div>
    <div class="card"><h2>还没背会的诗</h2><div class="chips">${D.poems.filter(x => !S.poems[x.id]?.mastered).map(x => `<span class="chip">${esc(x.t)}</span>`).join('') || '<span class="small">全部背会了 🎉</span>'}</div></div>
    <div class="card"><h2>设置</h2>
      <div class="row"><span>纸上原来已经写好的行数</span><input class="text" id="pre" type="number" min="0" max="25" value="${S.preDone}" style="width:100px"></div>
      <div class="row" style="margin-top:12px"><button class="btn ghost sm" id="export">📋 复制进度数据</button><button class="btn ghost sm" id="import">📥 粘贴导入</button><button class="btn coral sm" id="reset">🗑 全部重置</button></div>
      <div class="small" style="margin-top:8px">数据只保存在这台 iPad 上。</div>
    </div>
    <button class="btn ghost" onclick="location.hash='home'">← 返回</button>`;
  $('#pre').onchange = ev => { S.preDone = Math.max(0, Math.min(25, +ev.target.value || 0)); save(); toast('已保存'); };
  $('#export').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('已复制'); } catch (e) { prompt('复制这段：', JSON.stringify(S)); } };
  $('#import').onclick = () => { const t = prompt('粘贴进度数据：'); if (!t) return; try { S = Object.assign(defaultState(), JSON.parse(t)); save(); toast('已导入'); V.parent(); } catch (e) { toast('格式不对'); } };
  $('#reset').onclick = () => { if (confirm('真的要全部重置吗？星星会清零。')) { S = defaultState(); save(); V.parent(); } };
};

/* ---------- router ---------- */
function route() {
  TTS.stop();
  const h = (location.hash.slice(1) || 'home').split('/');
  const [v, a, b] = h;
  if (v === 'read' && a === 'card') V['read/card'](b);
  else if (v === 'read' && a) (V['read/' + a] || V.read)();
  else if (v === 'poem') V.poem(a, b);
  else if (v === 'write' && a === 'new') V['write/new']();
  else if (v === 'dict' && a) V.dictRun(a);
  else (V[v] || V.home)();
  window.scrollTo(0, 0);
}
addEventListener('hashchange', route);
$('#btn-home').onclick = () => go('home');
updateStars();
route();

if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
// unlock audio on first touch (iOS)
addEventListener('pointerdown', () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch (e) {} }, { once: true });
})();
