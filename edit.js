/*!
 * edit.js — BK에딧 ✂️ 자유 편집 (관리자 미리보기)
 * 영상 · 사진 넣기 → 분할 · 자르기 · 삭제 · 소리 분리 · 소리 추출(WAV) · 녹음(대본 띄우기) · 음악 · 글자 → MP4
 * 프로젝트 여러 개 · 휴지통 · 백업 파일(.bkedit) · 구글 드라이브 백업(공유 화면)
 * 모든 처리는 휴대폰 브라우저 안에서만 해요 (Canvas + WebAudio + WebCodecs). 서버로 올라가지 않아요.
 * 저장소: IndexedDB 'bk-editapp' (BK쇼츠 편집기의 'bk-edit'과 따로 — 서로 덮어쓰지 않음)
 */
(function (g) {
'use strict';
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = v => Math.round(v * 10) / 10;
const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
const fmtS = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
const ACx = g.AudioContext || g.webkitAudioContext;
const MAXF = 400 * 1048576;   // 이보다 큰 영상은 소리를 풀지 않아요 (휴대폰 메모리)
const RATIOS = { '9:16': [9, 16, '📱 세로 (쇼츠)'], '16:9': [16, 9, '🖥 가로 (유튜브)'], '1:1': [1, 1, '⬛ 정사각'] };

/* ═════════ 작은 도우미: 알림 · 기다림 · 판 ═════════ */
let toastT = 0;
function toast(m, ms) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600); }
let busyCancel = null;
function busy(m, p, onCancel) {
  const b = $('busy');
  if (m === '' || m == null) { b.hidden = true; busyCancel = null; return; }
  b.hidden = false; $('busyMsg').textContent = m; $('busyBar').style.width = (p == null ? 0 : clamp(p, 0, 1) * 100) + '%';
  $('busyBar').parentNode.hidden = p == null;
  if (onCancel !== undefined) { busyCancel = onCancel; $('busyCancel').hidden = !onCancel; }
}
$('busyCancel').addEventListener('click', () => { if (busyCancel) busyCancel(); });
let sheetClose = null;
function sheet(title, html, onClose) {
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  $('shTitle').textContent = title; $('shBody').innerHTML = html; $('sheet').hidden = false; $('dim').hidden = false; sheetClose = onClose || null;
  $('shBody').scrollTop = 0;
  return $('shBody');
}
function closeSheet() { $('sheet').hidden = true; $('dim').hidden = true; const f = sheetClose; sheetClose = null; if (f) f(); }
$('shOk').addEventListener('click', closeSheet); $('dim').addEventListener('click', closeSheet);
const pressed = (a, b) => ` aria-pressed="${a === b}"`;
function chips(name, list, cur) { return `<div class="chips" data-c="${name}">${list.map(([v, l]) => `<button type="button" data-v="${v}"${pressed(String(cur), String(v))}>${l}</button>`).join('')}</div>`; }
function onChips(box, fn) { box.addEventListener('click', e => { const b = e.target.closest('.chips button'); if (!b) return; const c = b.parentNode; c.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(c.dataset.c, b.dataset.v); }); }
function dl(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
function stampName() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }
/** 📤 공유 화면으로 보내기 (구글 드라이브 · 카톡 …) — 안 되면 내려받기 */
async function shareFiles(files, title) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: title || 'BK백업' }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  for (const f of files) { dl(f, f.name); await sleep(400); }
  return 'download';
}

/* ═════════ 저장소 (IndexedDB 'bk-editapp') ═════════ */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('bk-editapp', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('p'); r.result.createObjectStore('f'); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  },
  put(s, k, v) { return this.tx(s, 'readwrite', o => o.put(v, k)); },
  get(s, k) { return this.tx(s, 'readonly', o => o.get(k)); },
  del(s, k) { return this.tx(s, 'readwrite', o => o.delete(k)); },
  all(s) { return this.tx(s, 'readonly', o => o.getAll()); },
};

/* ═════════ 자료 (사진 · 영상 · 소리) ═════════ */
const SRC = new Map();
function vidEl(url) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url; return v; }
function waitMeta(v) {
  return new Promise((res, rej) => {
    if (v.readyState >= 1 && isFinite(v.duration)) return res();
    const ok = () => { cl(); res(); }, no = () => { cl(); rej(new Error('영상을 열 수 없어요 (MP4를 권장해요)')); };
    const cl = () => { v.removeEventListener('loadedmetadata', ok); v.removeEventListener('error', no); };
    v.addEventListener('loadedmetadata', ok); v.addEventListener('error', no);
    setTimeout(() => { cl(); v.readyState >= 1 ? res() : rej(new Error('영상을 여는 데 시간이 너무 걸려요')); }, 15000);
  });
}
function seekV(v, t) {
  return new Promise(res => {
    t = clamp(t, 0, Math.max(0, (v.duration || 0) - 0.04));
    if (Math.abs(v.currentTime - t) < 0.015 && v.readyState >= 2) return res();
    let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
    v.addEventListener('seeked', fin); v.currentTime = t; setTimeout(fin, 2000);
  });
}
async function bitmap(blob, max) {
  let b = null;
  try { b = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { b = null; }
  if (!b) { const u = URL.createObjectURL(blob); b = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('사진을 열 수 없어요')); im.src = u; }); }
  const w = b.width || b.naturalWidth, h = b.height || b.naturalHeight, k = Math.min(1, max / Math.max(w, h));
  if (k >= 1) return b;
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  if (b.close) b.close();
  return c;
}
function thumbOf(el, w, h) { const k = 96 / h, c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w * k)); c.height = 96; c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); try { return c.toDataURL('image/jpeg', .7); } catch (e) { return ''; } }
async function loadSrc(meta, blob) {
  if (SRC.has(meta.id)) return SRC.get(meta.id);
  const s = { meta, id: meta.id, kind: meta.kind, file: blob, url: URL.createObjectURL(blob) };
  if (s.kind === 'image') {
    s.img = await bitmap(blob, 1280); s.w = s.img.width; s.h = s.img.height; s.dur = 0; s.th = thumbOf(s.img, s.w, s.h);
  } else if (s.kind === 'video') {
    s.el = vidEl(s.url); await waitMeta(s.el); s.dur = s.el.duration; s.w = s.el.videoWidth || 1280; s.h = s.el.videoHeight || 720;
    try { await seekV(s.el, Math.min(.5, s.dur / 2)); s.th = thumbOf(s.el, s.w, s.h); } catch (e) { s.th = ''; }
  } else if (s.kind === 'audio') {
    s.abuf = await decodeAudio(blob); s.audTried = true; s.dur = s.abuf ? s.abuf.duration : 0;
    if (!s.abuf) throw new Error('소리 파일을 열 수 없어요');
  }
  meta.dur = s.dur;
  SRC.set(s.id, s);
  return s;
}
async function decodeAudio(blob) {
  try {
    const ab = await blob.arrayBuffer(), ctx = new OAC(2, 44100, 44100);
    return await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
  } catch (e) { return null; }
}
async function audioOf(s) {   // 영상 · 소리 파일의 소리 (한 번만 풀어 둠)
  if (!s) return null;
  if (s.audTried) return s.abuf;
  s.audTried = true;
  s.abuf = s.file && s.file.size < MAXF ? await decodeAudio(s.file) : null;
  return s.abuf;
}
async function fullImg(s) { if (!s.full) { try { s.full = await bitmap(s.file, 1920); } catch (e) { s.full = s.img; } } return s.full; }
function dropFull(s) { if (s.full && s.full !== s.img) { try { s.full.close && s.full.close(); } catch (e) { /* 무시 */ } } s.full = null; }
function freeAll() {
  for (const s of SRC.values()) { try { if (s.el) { s.el.pause(); s.el.removeAttribute('src'); s.el.load(); } URL.revokeObjectURL(s.url); if (s.img && s.img.close) s.img.close(); dropFull(s); } catch (e) { /* 무시 */ } }
  SRC.clear();
}

/* ═════════ 프로젝트 ═════════ */
let P = null, T = 0, SEL = null, UNDO = [], REDO = [], PPS = 50;
function newProject() {
  return { v: 1, id: uid('p'), name: '새 프로젝트 ' + new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }), ratio: '9:16', photoDur: 3, srcs: [], clips: [], auds: [], texts: [], fx: [], vmute: 0, script: '', nRec: 1, created: Date.now() };
}
const clipLen = c => c.kind === 'video' ? Math.max(.1, (c.out - c.in) / (c.speed || 1)) : Math.max(.3, c.dur || 3);
const audLen = a => Math.max(.05, (a.out - a.in) / (a.rate || 1));
function starts() { let t = 0; const st = []; for (const c of P.clips) { st.push(t); t += clipLen(c); } return { st, vEnd: t }; }
function total() {
  let m = starts().vEnd;
  for (const a of P.auds) m = Math.max(m, a.start + audLen(a));
  for (const x of P.texts) m = Math.max(m, x.start + x.dur);
  for (const x of P.fx) m = Math.max(m, x.start + x.dur);
  return m;
}
function clipAt(t) {
  const { st } = starts();
  for (let i = P.clips.length - 1; i >= 0; i--) if (t >= st[i] - 1e-6 && t < st[i] + clipLen(P.clips[i]) + 1e-6) return { i, c: P.clips[i], st: st[i], lt: t - st[i] };
  return null;
}
const srcTime = (c, lt) => c.in + clamp(lt, 0, clipLen(c)) * (c.speed || 1);
function findSel() {
  if (!SEL) return null;
  const L = SEL.type === 'clip' ? P.clips : SEL.type === 'aud' ? P.auds : SEL.type === 'fx' ? P.fx : P.texts, o = L.find(x => x.id === SEL.id);
  return o ? { type: SEL.type, o, L } : null;
}
/** 손댈 대상: 고른 것 → 없으면 빨간 선 아래 장면 */
function target(onlyClip) {
  const f = findSel();
  if (f && (!onlyClip || f.type === 'clip')) { const st = itemStart(f); if (T >= st - .01 && T <= st + itemLen(f) + .01) return f; }
  const A = clipAt(T); if (A) return { type: 'clip', o: A.c, L: P.clips };
  return null;
}
function itemStart(f) { if (f.type === 'clip') return starts().st[P.clips.indexOf(f.o)]; return f.o.start; }
function itemLen(f) { return f.type === 'clip' ? clipLen(f.o) : f.type === 'aud' ? audLen(f.o) : f.o.dur; }

/* 되돌리기 · 자동 저장 */
function snap() { UNDO.push(JSON.stringify(P)); if (UNDO.length > 60) UNDO.shift(); REDO = []; }
function mergeSrcs(old) { const have = new Set(P.srcs.map(m => m.id)); for (const m of old) if (!have.has(m.id)) P.srcs.push(m); }
function undo() { if (!UNDO.length) return; const old = P.srcs; REDO.push(JSON.stringify(P)); P = JSON.parse(UNDO.pop()); mergeSrcs(old); SEL = null; changed(true); toast('↩ 되돌렸어요', 1200); }
function redo() { if (!REDO.length) return; const old = P.srcs; UNDO.push(JSON.stringify(P)); P = JSON.parse(REDO.pop()); mergeSrcs(old); SEL = null; changed(true); }
let saveT = 0;
function changed() { T = clamp(T, 0, total()); renderTL(); seekPreview(); updBtns(); clearTimeout(saveT); saveT = setTimeout(saveNow, 700); }
async function saveNow() {
  if (!P) return; clearTimeout(saveT);
  let cover = '';
  try { const c = $('pv'), k = 160 / Math.max(c.width, c.height), t = document.createElement('canvas'); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); cover = t.toDataURL('image/jpeg', .7); } catch (e) { /* 무시 */ }
  try { await IDB.put('p', P.id, { id: P.id, name: P.name, at: Date.now(), created: P.created, trash: 0, dur: total(), cover, P }); }
  catch (e) { toast('저장 공간이 부족해 저장하지 못했어요. 쓰지 않는 프로젝트를 휴지통에서 지워 주세요'); }
}
function updBtns() { $('edUndo').disabled = !UNDO.length; $('edRedo').disabled = !REDO.length; $('edRatio').textContent = P.ratio; $('edName').textContent = P.name; }

/* ═════════ 그리기 ═════════ */
function drawMedia(x, img, iw, ih, W, H, fit, flt) {
  const cover = Math.max(W / iw, H / ih), contain = Math.min(W / iw, H / ih);
  if (fit === 'blur') {
    const k = cover, w = iw * k, h = ih * k;
    x.save(); x.filter = 'blur(18px) brightness(.55)' + (flt ? ' ' + flt : ''); x.drawImage(img, (W - w) / 2 - 20, (H - h) / 2 - 20, w + 40, h + 40); x.restore();
  }
  const k = fit === 'cover' ? cover : contain, w = iw * k, h = ih * k;
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
const TXT_COL = { w: '#ffffff', y: '#ffe14d', p: '#ff7eb3', s: '#7dd3fc', k: '#111111' };
function wrapLines(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) { const t = line + ch; if (x.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; }
    out.push(line);
  }
  return out;
}
function drawText(x, W, H, it, t) {
  if (!it.t || !it.t.trim()) return;
  const fs = Math.round(Math.min(W, H) * .085 * (it.size || 1)), lh = fs * 1.28;
  x.save(); x.font = `900 ${fs}px "Noto Sans KR", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const L = wrapLines(x, it.t, W * .88), y0 = H * (it.y || .82) - (L.length - 1) * lh / 2;
  const fi = clamp((t - it.start) / .25, 0, 1), fo = clamp((it.start + it.dur - t) / .25, 0, 1); x.globalAlpha = Math.min(fi, fo);
  if (it.box === 'box') {
    const w = Math.max(...L.map(l => x.measureText(l).width)) + fs * .9, h = L.length * lh + fs * .4;
    x.fillStyle = 'rgba(0,0,0,.62)'; const rx = (W - w) / 2, ry = y0 - lh / 2 - fs * .2;
    if (x.roundRect) { x.beginPath(); x.roundRect(rx, ry, w, h, fs * .3); x.fill(); } else x.fillRect(rx, ry, w, h);
  }
  L.forEach((l, i) => {
    const y = y0 + i * lh;
    if (it.box === 'line') { x.lineJoin = 'round'; x.lineWidth = fs * .2; x.strokeStyle = it.col === 'k' ? '#ffffff' : '#000000'; x.strokeText(l, W / 2, y); }
    x.fillStyle = TXT_COL[it.col] || '#fff'; x.fillText(l, W / 2, y);
  });
  x.restore();
}
/** 장면 하나(사진 · 영상)를 그림 — 색감 · 화면 맞춤 · 장면 안 페이드 */
function drawClip(x, W, H, A, imgOf) {
  const s = SRC.get(A.c.src); if (!s) return;
  const img = A.c.kind === 'video' ? s.el : (imgOf ? imgOf(s) : s.img);
  if (!img || (A.c.kind === 'video' && s.el.readyState < 2)) return;
  const fi = A.c.fi ? clamp(A.lt / A.c.fi, 0, 1) : 1, fo = A.c.fo ? clamp((clipLen(A.c) - A.lt) / A.c.fo, 0, 1) : 1;
  const flt = (g.BKFX.FILTERS[A.c.flt] || [0, ''])[1];
  x.save(); x.globalAlpha = Math.min(fi, fo); if (flt) x.filter = flt;
  drawMedia(x, img, s.w, s.h, W, H, A.c.fit || 'blur', flt);
  x.restore();
}
const SNAP = new WeakMap();   // 캔버스마다: 앞 장면 마지막 그림 · 이번 장면 그림 (장면 전환용)
function bufs(cv) { let o = SNAP.get(cv); if (!o) { o = { prev: document.createElement('canvas'), cur: document.createElement('canvas'), last: -1, has: false }; SNAP.set(cv, o); } for (const k of ['prev', 'cur']) if (o[k].width !== cv.width || o[k].height !== cv.height) { o[k].width = cv.width; o[k].height = cv.height; } return o; }
/** t초의 화면 그리기. imgOf: 사진 고르기 (미리보기는 작은 것 · 영상 만들 때는 큰 것) */
function drawAt(x, W, H, t, imgOf) {
  const FX = g.BKFX, A = clipAt(t), on = P.fx.filter(f => t >= f.start && t < f.start + f.dur), B = bufs(x.canvas);
  // 앞 장면에서 다음 장면으로 막 넘어온 순간: 앞 장면 마지막 그림을 잡아 둠
  if (A && A.i !== B.last) { if (A.i === B.last + 1 && B.has) B.prev.getContext('2d').drawImage(x.canvas, 0, 0); else B.prev.getContext('2d').clearRect(0, 0, W, H); B.hasPrev = A.i === B.last + 1 && B.has; B.last = A.i; }
  const tr = A && A.i > 0 && A.c.tr && A.c.tr !== 'cut' ? A.c.tr : '', td = A ? (A.c.td || .6) : 0;
  const layer = (cx) => { cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); if (!A) return; cx.save(); FX.preTransform(cx, W, H, on.filter(f => f.type === 'efx'), t); drawClip(cx, W, H, A, imgOf); cx.restore(); };
  if (tr && A.lt < td) { const c = B.cur.getContext('2d'); layer(c); FX.transition(x, W, H, tr, B.hasPrev ? B.prev : null, B.cur, A.lt / td); }
  else layer(x);
  for (const f of on) if (f.type === 'efx') FX.overlay(x, W, H, f, t);
  for (const f of on) if (f.type === 'mos') FX.mosaic(x, W, H, f);
  for (const f of on) if (f.type === 'stk') FX.drawSticker(x, W, H, f, t);
  for (const it of P.texts) if (t >= it.start && t < it.start + it.dur) { if (it.st) FX.drawCaption(x, W, H, it, t); else drawText(x, W, H, it, t); }
  B.has = true;
}
function pvSize() { const [a, b] = RATIOS[P.ratio]; const k = 720 / Math.max(a, b); return [Math.round(a * k / 2) * 2, Math.round(b * k / 2) * 2]; }
function fitCanvas() { const c = $('pv'), [w, h] = pvSize(); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
function drawPV() { const c = $('pv'); drawAt(c.getContext('2d'), c.width, c.height, T); }
let seekBusy = false, seekAgain = false;
async function seekPreview() {
  if (PLAY) return;
  if (seekBusy) { seekAgain = true; return; }
  seekBusy = true;
  try {
    do {
      seekAgain = false; fitCanvas(); const A = clipAt(T);
      if (A && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) { s.el.pause(); await seekV(s.el, srcTime(A.c, A.lt)); } }
      drawPV(); $('tNow').textContent = fmt(T); $('tAll').textContent = fmtS(total());
    } while (seekAgain);
  } finally { seekBusy = false; }
}

/* ═════════ 소리 (미리보기 · 영상 만들기 같은 방법) ═════════ */
function audioParts(from) {
  const out = [], { st } = starts();
  if (!P.vmute) P.clips.forEach((c, i) => {
    if (c.kind !== 'video' || c.mute || !(c.vol > 0)) return;
    out.push({ src: c.src, at: st[i], off: c.in, len: clipLen(c), rate: c.speed || 1, vol: c.vol, fi: c.fi || 0, fo: c.fo || 0, duckable: 1 });
  });
  for (const a of P.auds) {
    const voice = a.duck && a.duck !== 'none';
    out.push({ src: a.src, at: a.start, off: a.in, len: audLen(a), rate: a.rate || 1, vol: a.vol == null ? 1 : a.vol, fi: a.fi || 0, fo: a.fo || 0, duckable: !voice && !a.noDuck, voice, lv: a.duck === 'cut' ? 0 : (a.dlv == null ? .4 : a.dlv) });
  }
  return out.filter(p => p.at + p.len > from + .01);
}
/** 🔉 목소리가 나오는 구간 (그 동안 다른 소리를 줄이거나 꺼요) */
function duckZones() {
  const z = P.auds.filter(a => a.duck && a.duck !== 'none').map(a => ({ s: a.start, e: a.start + audLen(a), lv: a.duck === 'cut' ? 0 : (a.dlv == null ? .4 : a.dlv) })).sort((p, q) => p.s - q.s);
  const m = []; for (const q of z) { const l = m[m.length - 1]; if (l && q.s - l.e < .6) { l.e = Math.max(l.e, q.e); l.lv = Math.min(l.lv, q.lv); } else m.push(Object.assign({}, q)); }
  return m;
}
async function needAudio(parts, show) {
  const ids = [...new Set(parts.map(p => p.src))].filter(id => { const s = SRC.get(id); return s && !s.audTried; });
  for (let i = 0; i < ids.length; i++) { if (show) busy(`소리 준비 중… (${i + 1}/${ids.length})`, i / ids.length, null); await audioOf(SRC.get(ids[i])); }
  if (show && ids.length) busy('');
}
function schedule(ctx, dest, parts, from, when0) {
  const nodes = [], zones = duckZones(), R = .3, ct = tt => when0 + (tt - from);
  for (const p of parts) {
    const s = SRC.get(p.src), buf = s && s.abuf; if (!buf) continue;
    const skip = Math.max(0, from - p.at), rem = p.len - skip; if (rem <= .02) continue;
    const off = p.off + skip * p.rate; if (off >= buf.duration - .01) continue;
    const n = ctx.createBufferSource(); n.buffer = buf; n.playbackRate.value = p.rate;
    const gn = ctx.createGain(), when = when0 + Math.max(0, p.at - from), v = p.vol, end = when + rem;
    const f = Math.min(.03, rem / 4), fi = Math.max(f, p.fi), fo = Math.max(f, p.fo);
    const tIn = when + Math.max(0, fi - skip);
    gn.gain.setValueAtTime(skip >= fi ? v : v * (skip / fi), when); if (tIn > when) gn.gain.linearRampToValueAtTime(v, tIn);
    gn.gain.setValueAtTime(v, Math.max(tIn, end - fo)); gn.gain.linearRampToValueAtTime(0, end);
    let last = gn;
    if (p.duckable && zones.length) {   // 목소리 나올 때 스르르 줄였다가 다시 키우기
      const dk = ctx.createGain(); dk.gain.setValueAtTime(1, when); let tcur = when;
      for (const z of zones) {
        const a = ct(z.s), b = ct(z.e); if (b + R < when || a - R > end) continue;
        const a0 = Math.max(tcur, a - R), b1 = Math.max(a0 + .01, b + R);
        if (a > tcur) { dk.gain.setValueAtTime(1, a0); dk.gain.linearRampToValueAtTime(z.lv, Math.max(a0 + .01, a)); } else dk.gain.setValueAtTime(z.lv, Math.max(tcur, when));
        dk.gain.setValueAtTime(z.lv, Math.max(a0 + .01, b)); dk.gain.linearRampToValueAtTime(1, b1); tcur = b1;
      }
      gn.connect(dk); last = dk;
    }
    n.connect(gn); last.connect(dest); n.start(when, off, Math.min(rem * p.rate, buf.duration - off)); nodes.push(n);
  }
  for (const f of P.fx) if (f.type === 'sfx' && f.start >= from - .01) { try { g.BKFX.sfx(ctx, dest, f.k, when0 + (f.start - from)); } catch (e) { /* 무시 */ } }
  return nodes;
}

/* ═════════ 재생 ═════════ */
let PLAY = null, AC = null, MONLV = 1, MON = null;
async function play() {
  if (PLAY) { pause(); return; }
  if (T >= total() - .05) T = 0;
  const parts = audioParts(T); await needAudio(parts, true);
  if (!AC) AC = new ACx(); try { await AC.resume(); } catch (e) { /* 무시 */ }
  if (!MON) { MON = AC.createGain(); MON.connect(AC.destination); } MON.gain.value = MONLV;
  const t0 = AC.currentTime + .08, nodes = schedule(AC, MON, parts, T, t0);
  PLAY = { t0, T0: T, nodes, cur: null }; $('edPlay').textContent = '❚❚';
  const loop = async () => {
    if (!PLAY) return;
    const now = PLAY.T0 + Math.max(0, AC.currentTime - PLAY.t0);
    if (now >= total()) { T = total(); pause(); return; }
    T = now;
    const A = clipAt(T), key = A ? A.c.id : null;
    if (key !== PLAY.cur) {
      if (PLAY.curEl) PLAY.curEl.pause();
      PLAY.cur = key; PLAY.curEl = null;
      if (A && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) { s.el.muted = true; s.el.playbackRate = A.c.speed || 1; s.el.currentTime = srcTime(A.c, A.lt); s.el.play().catch(() => {}); PLAY.curEl = s.el; } }
    } else if (A && A.c.kind === 'video' && PLAY.curEl) {
      const want = srcTime(A.c, A.lt); if (Math.abs(PLAY.curEl.currentTime - want) > .3) PLAY.curEl.currentTime = want;
    }
    drawPV(); $('tNow').textContent = fmt(T); scrollTo(T);
    PLAY.raf = requestAnimationFrame(loop);
  };
  loop();
}
function pause() {
  if (!PLAY) return;
  cancelAnimationFrame(PLAY.raf); for (const n of PLAY.nodes) { try { n.stop(); } catch (e) { /* 끝남 */ } }
  if (PLAY.curEl) PLAY.curEl.pause();
  PLAY = null; $('edPlay').textContent = '▶'; seekPreview();
}
$('edPlay').addEventListener('click', play);

/* ═════════ 타임라인 ═════════ */
const tl = $('tl'), tlin = $('tlin');
let progLeft = -1;
function pad() { return tl.clientWidth / 2; }
function scrollTo(t) { tl.scrollLeft = t * PPS; progLeft = tl.scrollLeft; }
function renderTL() {
  const tot = total(), w = Math.max(tl.clientWidth, tot * PPS + tl.clientWidth), p = pad(), { st } = starts();
  const step = PPS >= 90 ? 1 : PPS >= 40 ? 2 : PPS >= 18 ? 5 : 10;
  let h = '';
  for (let s = 0; s <= tot + step; s += step) h += `<span class="ruler" style="left:${p + s * PPS - 10}px">${fmtS(s)}</span>`;
  P.clips.forEach((c, i) => {
    const sc = SRC.get(c.src), sel = SEL && SEL.id === c.id ? ' sel' : '', len = clipLen(c);
    h += `<div class="it v${sel}${c.mute ? ' muted' : ''}" data-t="clip" data-id="${c.id}" style="left:${p + st[i] * PPS}px;width:${Math.max(6, len * PPS - 2)}px;${sc && sc.th ? `background-image:url(${sc.th})` : ''}"><span class="tag">${c.kind === 'video' ? '🎞' : '📷'} ${r1(len)}s${(c.speed || 1) !== 1 ? ' ×' + c.speed : ''}</span></div>`;
  });
  for (const a of P.auds) {
    const sel = SEL && SEL.id === a.id ? ' sel' : '', cls = a.kind === 'rec' ? ' rec' : a.kind === 'mus' ? ' mus' : '';
    h += `<div class="it a${cls}${sel}" data-t="aud" data-id="${a.id}" style="left:${p + a.start * PPS}px;width:${Math.max(6, audLen(a) * PPS - 2)}px">${a.kind === 'rec' ? '🎙' : a.kind === 'mus' ? '🎵' : '🔊'} ${esc(a.name || '소리')}</div>`;
  }
  for (const x of P.texts) {
    const sel = SEL && SEL.id === x.id ? ' sel' : '';
    h += `<div class="it t${sel}" data-t="text" data-id="${x.id}" style="left:${p + x.start * PPS}px;width:${Math.max(6, x.dur * PPS - 2)}px">🔤 ${esc(x.t.slice(0, 20))}</div>`;
  }
  for (const f of P.fx) {
    const sel = SEL && SEL.id === f.id ? ' sel' : '', FX = g.BKFX;
    const lb = f.type === 'stk' ? (f.e || (FX.BADGES[f.b] || [''])[0]) : f.type === 'efx' ? FX.EFX[f.k] : f.type === 'sfx' ? FX.SFX[f.k] : '🫥 가리기';
    h += `<div class="it f ${f.type}${sel}" data-t="fx" data-id="${f.id}" style="left:${p + f.start * PPS}px;width:${Math.max(6, f.dur * PPS - 2)}px">${esc(lb || '')}</div>`;
  }
  if (!P.clips.length) h += `<div class="lane" style="left:${p + 8}px;top:24px">➕ 넣기로 영상 · 사진을 넣어요</div>`;
  tlin.style.width = w + 'px'; tlin.innerHTML = h;
  if (!PLAY) scrollTo(T);
}
tl.addEventListener('scroll', () => {
  if (Math.abs(tl.scrollLeft - progLeft) < 1) return;   // 프로그램이 움직인 것
  if (PLAY) pause();
  progLeft = -1;
  T = clamp(tl.scrollLeft / PPS, 0, total()); $('tNow').textContent = fmt(T); seekPreview();
}, { passive: true });
tlin.addEventListener('click', e => {
  if (drag && drag.moved) return;
  const it = e.target.closest('.it');
  SEL = it ? { type: it.dataset.t, id: it.dataset.id } : null; renderTL();
});
/* 소리 · 글자 줄은 고른 뒤 손가락으로 끌어 옮기기 */
let drag = null;
tlin.addEventListener('pointerdown', e => {
  const it = e.target.closest('.it.sel'); if (!it || it.dataset.t === 'clip') return;
  const f = findSel(); if (!f) return;
  drag = { x: e.clientX, s0: f.o.start, f, moved: false, el: it, snapped: false }; it.setPointerCapture(e.pointerId);
});
tlin.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) < 8) return;
  if (!drag.snapped) { snap(); drag.snapped = true; }
  drag.moved = true; drag.f.o.start = Math.max(0, r1(drag.s0 + dx / PPS)); drag.el.style.left = (pad() + drag.f.o.start * PPS) + 'px';
});
const endDrag = () => { if (!drag) return; const d = drag; setTimeout(() => { drag = null; }, 0); if (d.moved) changed(); };
tlin.addEventListener('pointerup', endDrag); tlin.addEventListener('pointercancel', endDrag);
$('zIn').addEventListener('click', () => { PPS = Math.min(240, PPS * 1.5); renderTL(); });
$('zOut').addEventListener('click', () => { PPS = Math.max(8, PPS / 1.5); renderTL(); });
window.addEventListener('resize', () => { if (P && !$('editor').hidden) renderTL(); });

/* ═════════ 넣기 ═════════ */
$('addFile').addEventListener('change', async e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) await addFiles(fs); });
/** ➕ 넣기: 갤러리 · 내 파일 · 내 보관함 중에서 고르기 (고른 뒤 「보관함에도 담을까요?」) */
async function openAdd() { if (PLAY) pause(); const r = await g.BKKIT.open({ gallery: 1, files: 1, lib: 1 }); if (r && r.files && r.files.length) await addFiles(r.files); }
async function addFiles(fs) {
  if (PLAY) pause();
  snap();
  const A = clipAt(T); let pos = A ? A.i + (A.lt > clipLen(A.c) / 2 ? 1 : 0) : P.clips.length;
  if (A && A.lt < .05) pos = A.i;
  let n = 0, last = null;
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i], kind = /^video\//.test(f.type) || /\.(mp4|mov|webm|m4v|3gp)$/i.test(f.name) ? 'video' : /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name) ? 'image' : '';
    if (!kind) continue;
    busy(`불러오는 중… (${i + 1}/${fs.length})`, i / fs.length, null);
    const meta = { id: uid('s'), kind, name: f.name, type: f.type, size: f.size };
    try {
      const s = await loadSrc(meta, f);
      try { await IDB.put('f', meta.id, f); } catch (er) { toast('저장 공간이 부족해요'); }
      P.srcs.push(meta);
      const c = { id: uid('c'), kind, src: meta.id, in: 0, out: kind === 'video' ? s.dur : 0, dur: kind === 'image' ? P.photoDur : 0, speed: 1, vol: 1, mute: 0, fit: 'blur', fi: 0, fo: 0 };
      P.clips.splice(pos++, 0, c); n++; last = c;
    } catch (er) { toast('❌ ' + f.name + ' — ' + er.message); }
  }
  busy('');
  if (!n) { UNDO.pop(); return; }
  if (last) { SEL = { type: 'clip', id: last.id }; T = starts().st[P.clips.indexOf(last)]; }
  changed(); toast(`➕ ${n}개를 넣었어요`);
}

/* ═════════ 분할 · 자르기 · 삭제 ═════════ */
function split() {
  const f = target(); if (!f) return toast('먼저 영상 · 사진을 넣어 주세요');
  const st = itemStart(f), len = itemLen(f), lt = T - st;
  if (lt < .1 || lt > len - .1) return toast('빨간 선을 나눌 곳(조각 가운데)에 맞춰 주세요');
  snap();
  const o = f.o, b = Object.assign({}, o, { id: uid(f.type[0]) });
  if (f.type === 'clip') { if (o.kind === 'video') { const cut = srcTime(o, lt); o.out = cut; b.in = cut; } else { o.dur = r1(lt); b.dur = r1(len - lt); } b.fi = 0; o.fo = 0; }
  else if (f.type === 'aud') { const cut = o.in + lt * (o.rate || 1); o.out = cut; b.in = cut; b.start = T; b.fi = 0; o.fo = 0; }
  else { o.dur = lt; b.start = T; b.dur = len - lt; }
  f.L.splice(f.L.indexOf(o) + 1, 0, b); SEL = { type: f.type, id: b.id };
  changed(); toast('✂️ 둘로 나눴어요', 1400);
}
function trimSheet() {
  const f = target(); if (!f) return toast('먼저 영상 · 사진을 넣어 주세요');
  SEL = { type: f.type, id: f.o.id }; renderTL();
  const isLen = f.type === 'text' || (f.type === 'clip' && f.o.kind === 'image');
  const b = sheet('📐 자르기', `<p class="muted">빨간 선 자리를 기준으로 잘라요. 잘못되면 ↩ 되돌리기.</p>
    <div class="two"><button type="button" class="big sec" data-x="front">◀ 여기 앞 버리기</button><button type="button" class="big sec" data-x="back">여기 뒤 버리기 ▶</button></div>
    ${isLen ? `<h4>⏱ 길이 <b id="lenV">${r1(itemLen(f))}초</b></h4><div class="chips" data-c="len">${[-1, -.1, .1, 1].map(v => `<button type="button" data-v="${v}">${v > 0 ? '+' : '−'}${Math.abs(v)}초</button>`).join('')}</div>` : ''}
    <div class="note">🎞 영상: 앞을 버리면 뒤 장면이 당겨져요 · 🔊 소리 · 🔤 글자: 그 조각만 짧아져요</div>`);
  b.addEventListener('click', e => {
    const x = e.target.closest('[data-x]'), c = e.target.closest('[data-c="len"] button');
    const F = findSel(); if (!F) return;
    if (x) {
      const st = itemStart(F), len = itemLen(F), lt = T - st;
      if (lt < .05 || lt > len - .05) return toast('빨간 선을 이 조각 안에 맞춰 주세요');
      snap(); const o = F.o;
      if (x.dataset.x === 'front') {
        if (F.type === 'clip') { if (o.kind === 'video') o.in = srcTime(o, lt); else o.dur = r1(len - lt); T = st; }
        else if (F.type === 'aud') { o.in += lt * (o.rate || 1); o.start = T; }
        else { o.start = T; o.dur = len - lt; }
      } else {
        if (F.type === 'clip') { if (o.kind === 'video') o.out = srcTime(o, lt); else o.dur = r1(lt); }
        else if (F.type === 'aud') o.out = o.in + lt * (o.rate || 1);
        else o.dur = lt;
      }
      changed(); closeSheet(); toast('📐 잘랐어요', 1300); return;
    }
    if (c) { snap(); const o = F.o; o.dur = Math.max(.3, r1(o.dur + Number(c.dataset.v))); const v = $('lenV'); if (v) v.textContent = r1(o.dur) + '초'; changed(); }
  });
}
function del() {
  const f = findSel() || target(); if (!f) return toast('지울 것이 없어요');
  snap(); f.L.splice(f.L.indexOf(f.o), 1); SEL = null; changed(); toast('🗑 지웠어요 · ↩로 되돌릴 수 있어요', 1800);
}

/* ═════════ 🔊 소리 분리 · 🎧 소리 추출 ═════════ */
async function separate() {
  const f = target(true); if (!f || f.o.kind !== 'video') return toast('🎞 영상 조각을 골라 주세요 (사진에는 소리가 없어요)');
  const c = f.o, s = SRC.get(c.src);
  if (s.file.size >= MAXF) return toast('영상이 너무 커서(400MB 넘음) 소리를 풀 수 없어요');
  busy('소리를 떼어내는 중…', null, null); const buf = await audioOf(s); busy('');
  if (!buf) return toast('이 영상에는 소리가 없거나 열 수 없어요');
  if (c.mute && P.auds.some(a => a.src === c.src && a.sepOf === c.id)) return toast('이미 분리했어요 (아래 초록 줄)');
  snap();
  const a = { id: uid('a'), src: c.src, kind: 'sep', name: '분리된 소리', start: starts().st[P.clips.indexOf(c)], in: c.in, out: c.out, rate: c.speed || 1, vol: c.vol == null ? 1 : c.vol, fi: 0, fo: 0, sepOf: c.id };
  P.auds.push(a); c.mute = 1; SEL = { type: 'aud', id: a.id };
  changed(); toast('🔊 소리를 아래 줄로 분리했어요 · 영상은 소리가 꺼져요', 2400);
}
function wavBlob(buf, from, to) {
  const sr = buf.sampleRate, a = Math.max(0, Math.floor(from * sr)), b = Math.min(buf.length, Math.ceil(to * sr)), n = Math.max(0, b - a), ch = Math.min(2, buf.numberOfChannels);
  const dv = new DataView(new ArrayBuffer(44 + n * ch * 2)), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const C = []; for (let k = 0; k < ch; k++) C.push(buf.getChannelData(k));
  let o = 44; for (let i = a; i < b; i++) for (let k = 0; k < ch; k++) { const v = clamp(C[k][i], -1, 1); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([dv], { type: 'audio/wav' });
}
async function extractWav() {
  const f = target(); let s = null, from = 0, to = 0;
  if (f && f.type === 'clip' && f.o.kind === 'video') { s = SRC.get(f.o.src); from = f.o.in; to = f.o.out; }
  else if (f && f.type === 'aud') { s = SRC.get(f.o.src); from = f.o.in; to = f.o.out; }
  if (!s) return toast('🎞 영상 조각이나 🔊 소리 줄을 골라 주세요');
  if ((to - from) > 600) return toast('10분이 넘는 소리는 한 번에 뽑을 수 없어요. 먼저 ✂️ 분할해 주세요');
  busy('소리를 뽑는 중…', null, null); const buf = await audioOf(s); busy('');
  if (!buf) return toast('소리가 없거나 열 수 없어요');
  const blob = wavBlob(buf, from, to), name = `BK에딧_소리_${stampName()}.wav`;
  const r = await shareFiles([new File([blob], name, { type: 'audio/wav' })], name);
  if (r === 'download') toast('🎧 WAV 파일을 저장했어요 (다운로드 폴더)');
}

/* ═════════ 🎵 오디오 ═════════ */
function audioSheet() {
  const f = findSel(), isA = f && f.type === 'aud', isV = f && f.type === 'clip' && f.o.kind === 'video';
  const o = f && f.o;
  const b = sheet('🎵 오디오', `
    <button type="button" class="big pri" data-x="mus">🎵 음악 · 소리 파일 넣기</button>
    <button type="button" class="big sec" data-x="rec">🎙 더빙하기 (영상 보며 녹음 · 대본 띄우기)</button>
    <button type="button" class="big sec" data-x="wav">🎧 소리 추출 (WAV 파일로 저장)</button>
    ${isA || isV ? `<h4>🔊 ${isA ? '고른 소리' : '영상 원래 소리'} 크기 <b id="volV">${Math.round((o.vol == null ? 1 : o.vol) * 100)}%</b></h4>
      <div class="rng"><input type="range" id="vol" min="0" max="${isA ? 200 : 100}" step="5" value="${Math.round((o.vol == null ? 1 : o.vol) * 100)}"><span></span></div>
      <h4>🌅 서서히 커지기 (페이드 인)</h4>${chips('fi', [[0, '없음'], [.5, '0.5초'], [1, '1초'], [2, '2초']], o.fi || 0)}
      <h4>🌇 서서히 작아지기 (페이드 아웃)</h4>${chips('fo', [[0, '없음'], [.5, '0.5초'], [1, '1초'], [2, '2초'], [3, '3초']], o.fo || 0)}` : '<div class="note">💡 아래 줄의 🔊 소리나 🎞 영상을 먼저 고르면 소리 크기 · 페이드를 바꿀 수 있어요.</div>'}
    ${isV ? `<button type="button" class="big sec" data-x="mute">${o.mute ? '🔈 원래 소리 다시 켜기' : '🔇 원래 소리 끄기'}</button>` : ''}
    ${isA && o.duck && o.duck !== 'none' || isA && o.kind === 'rec' ? `<h4>🔉 이 목소리가 나올 때 다른 소리</h4>${chips('duck', [['none', '그대로'], ['duck', '줄이기'], ['cut', '끄기']], o.duck || 'none')}${chips('dlv', [[.7, '조금'], [.4, '보통'], [.2, '많이']], o.dlv == null ? .4 : o.dlv)}` : ''}
    ${isA && o.kind !== 'rec' && !(o.duck && o.duck !== 'none') ? `<h4>🎵 목소리 나올 때 이 소리</h4>${chips('noDuck', [[0, '줄이기'], [1, '그대로']], o.noDuck ? 1 : 0)}` : ''}
    <h4>🎞 영상 원래 소리 (전체)</h4>${chips('vmute', [[0, '🔊 켜기'], [1, '🔇 전부 끄기']], P.vmute ? 1 : 0)}`);
  let snapped = false; const once = () => { if (!snapped) { snap(); snapped = true; } };
  const vol = b.querySelector('#vol');
  if (vol) vol.addEventListener('input', () => { once(); o.vol = vol.value / 100; $('volV').textContent = vol.value + '%'; clearTimeout(saveT); saveT = setTimeout(saveNow, 700); });
  onChips(b, (k, v) => { once(); if (k === 'vmute') P.vmute = Number(v); else if (k === 'duck') o.duck = v; else if (o) o[k] = Number(v); if (f && f.type === 'clip') seekPreview(); clearTimeout(saveT); saveT = setTimeout(saveNow, 700); });
  b.addEventListener('click', e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'mus') { closeSheet(); $('musFile').click(); }
    if (x.dataset.x === 'rec') openDub();
    if (x.dataset.x === 'wav') { closeSheet(); extractWav(); }
    if (x.dataset.x === 'mute') { snap(); o.mute = o.mute ? 0 : 1; closeSheet(); changed(); toast(o.mute ? '🔇 원래 소리를 껐어요' : '🔈 원래 소리를 켰어요'); }
  });
}
$('musFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  busy('소리 파일 여는 중…', null, null);
  const meta = { id: uid('s'), kind: 'audio', name: file.name, type: file.type, size: file.size };
  try {
    if (file.size >= MAXF) throw new Error('파일이 너무 커요 (400MB 넘음)');
    const s = await loadSrc(meta, file); try { await IDB.put('f', meta.id, file); } catch (er) { /* 공간 */ }
    snap(); P.srcs.push(meta);
    const a = { id: uid('a'), src: meta.id, kind: 'mus', name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), start: T, in: 0, out: s.dur, rate: 1, vol: .8, fi: 0, fo: 2 };
    P.auds.push(a); SEL = { type: 'aud', id: a.id }; busy(''); changed(); toast('🎵 빨간 선 자리에 넣었어요 · 길면 📐 자르기로 줄여요', 2600);
  } catch (er) { busy(''); toast('❌ ' + er.message); }
});

/* ═════════ 🎙 더빙 화면 — 위에 영상 · 구간 막대 · 가운데 대본 · 영상과 녹음이 같이 시작 ═════════ */
let REC = null, DUB = null;
const LAT = { auto: .15, 0: 0, .1: .1, .2: .2, .3: .3 };
function openDub() {
  if (PLAY) pause(); closeSheet();
  const tot = total(); if (tot < .3) return toast('먼저 ➕ 넣기로 영상 · 사진을 넣어 주세요');
  DUB = { s: r1(clamp(T, 0, Math.max(0, tot - .2))), e: null, mon: P.dubMon || 'low', duck: P.dubDuck || 'duck', dlv: P.dubLv == null ? .4 : P.dubLv, lat: P.dubLat || 'auto', spd: P.scrSpd || 1, take: null };
  const box = $('dub'); box.hidden = false; history.pushState({ dub: 1 }, '');
  $('dubStage').appendChild($('pv'));   // 같은 미리보기 화면을 더빙 화면 위쪽으로 옮겨 씀
  $('dubPos').max = tot; $('dubPos').value = DUB.s;
  renderDub(); T = DUB.s; seekPreview();
}
function closeDub() {
  if (!DUB) return; if (REC) stopRec(false); if (PLAY) pause(); if (g.BKKIT) g.BKKIT.stop();
  $('editorStage').appendChild($('pv')); $('dub').hidden = true; DUB = null; changed();
}
function renderDub() {
  const D = DUB; if (!D) return;
  $('dubRange').textContent = `시작 ${fmt(D.s)} · 끝 ${D.e == null ? '(멈출 때까지)' : fmt(D.e)}`;
  const lines = String(P.script || '').split('\n').map(l => l.trim()).filter(Boolean);
  $('dubScript').innerHTML = lines.length ? lines.map((l, i) => `<div class="dl" data-i="${i}">${esc(l)}</div>`).join('') : '<div class="dl muted">✏️ 아래 「대본 쓰기」에 읽을 글을 써 넣으면 여기에 크게 보여요</div>';
  $('dubTxt').value = P.script || '';
  const ch = (id, list, cur) => { $(id).innerHTML = list.map(([v, l]) => `<button type="button" data-v="${v}"${pressed(String(cur), String(v))}>${l}</button>`).join(''); };
  ch('dubMon', [['on', '🔊 그대로'], ['low', '🔉 작게'], ['off', '🔇 끄기']], D.mon);
  ch('dubDuck', [['none', '🔊 그대로'], ['duck', '🔉 목소리 나올 때만 줄이기'], ['cut', '🔇 목소리 구간만 끄기'], ['all', '🔇 영상 소리 전부 끄기']], D.duck);
  ch('dubLv', [[.7, '조금'], [.4, '보통'], [.2, '많이']], D.dlv);
  ch('dubLat', [['auto', '자동'], [0, '0초'], [.1, '0.1초'], [.2, '0.2초'], [.3, '0.3초']], D.lat);
  ch('dubSpd', [[.6, '느리게'], [1, '보통'], [1.5, '빠르게']], D.spd);
  $('dubLvRow').hidden = D.duck !== 'duck';
  $('dubGo').hidden = !!REC || !!D.take; $('dubStop').hidden = !REC; $('dubAfter').hidden = !D.take || !!REC;
}
function dubLine(el) {   // 지금 읽을 줄 노랗게 · 가운데로
  const L = [...$('dubScript').querySelectorAll('.dl[data-i]')]; if (!L.length) return;
  const cps = 6 * (DUB ? DUB.spd : 1); let acc = 0, idx = L.length - 1;
  for (let i = 0; i < L.length; i++) { acc += L[i].textContent.length / cps + .4; if (el < acc) { idx = i; break; } }
  L.forEach((d, i) => d.classList.toggle('on', i === idx));
  const box = $('dubScript'), d = L[idx]; box.scrollTop = d.offsetTop - box.clientHeight / 2 + d.clientHeight / 2;
}
async function startRec() {
  const D = DUB; if (!D || REC) return;
  if (D.e != null && D.e <= D.s + .3) return toast('끝 지점이 시작보다 뒤에 있어야 해요');
  let stream = null;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return toast('🎙 마이크를 쓸 수 없어요. 크롬 주소창 왼쪽 자물쇠 → 마이크 허용', 4000); }
  T = D.s; await seekPreview();
  const cd = $('dubCd'); cd.hidden = false;
  for (const n of [3, 2, 1]) { cd.textContent = n; await sleep(800); }
  cd.hidden = true;
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => g.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), parts = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  REC = { mr, stream, parts, at: D.s, t0: performance.now() };
  mr.start(250); MONLV = D.mon === 'on' ? 1 : D.mon === 'low' ? .25 : 0; renderDub();
  await play();   // 영상 재생과 녹음을 같은 순간에
  const tick = () => { if (!REC) return; const el = (performance.now() - REC.t0) / 1000; dubLine(el); $('dubPos').value = T; if (D.e != null && T >= D.e) { stopRec(true); return; } REC.raf = requestAnimationFrame(tick); };
  tick();
}
function stopRec(keep) {
  const R = REC; REC = null; if (!R) return;
  cancelAnimationFrame(R.raf); MONLV = 1; if (PLAY) pause();
  const len = (performance.now() - R.t0) / 1000;
  R.mr.onstop = async () => {
    R.stream.getTracks().forEach(t => t.stop());
    if (!keep || !DUB) { renderDub(); return; }
    const D = DUB, blob = new Blob(R.parts, { type: R.mr.mimeType || 'audio/webm' });
    const meta = { id: uid('s'), kind: 'audio', name: '더빙 ' + (P.nRec || 1), type: blob.type, size: blob.size };
    try {
      busy('녹음 넣는 중…', null, null); const s = await loadSrc(meta, blob); try { await IDB.put('f', meta.id, blob); } catch (e) { /* 공간 */ }
      busy('');
      const lat = LAT[D.lat] == null ? .15 : LAT[D.lat], end = R.at + Math.min(len, s.dur);
      const old = P.auds.filter(a => a.kind === 'rec' && a.start < end && a.start + audLen(a) > R.at);
      snap();
      if (old.length && confirm(`이 구간에 앞서 넣은 녹음이 ${old.length}개 있어요.\n앞의 녹음을 새 녹음으로 바꿀까요?\n\n(취소를 누르면 둘 다 남겨요)`)) P.auds = P.auds.filter(a => !old.includes(a));
      P.srcs.push(meta); P.nRec = (P.nRec || 1) + 1;
      const a = { id: uid('a'), src: meta.id, kind: 'rec', name: meta.name, start: R.at, in: Math.min(lat, Math.max(0, s.dur - .1)), out: s.dur, rate: 1, vol: 1.2, fi: 0, fo: 0,
        duck: D.duck === 'all' ? 'none' : D.duck, dlv: D.dlv };
      if (D.duck === 'all') P.vmute = 1;
      P.auds.push(a); SEL = { type: 'aud', id: a.id }; D.take = a.id;
      P.dubMon = D.mon; P.dubDuck = D.duck; P.dubLv = D.dlv; P.dubLat = D.lat; P.scrSpd = D.spd;
      changed(); renderDub(); toast('🎙 녹음을 넣었어요 · ▶ 같이 들어보기로 확인해요', 2600);
    } catch (e) { busy(''); toast('❌ 녹음을 넣지 못했어요'); renderDub(); }
  };
  try { R.mr.stop(); } catch (e) { R.stream.getTracks().forEach(t => t.stop()); }
  renderDub();
}
$('dubPos').addEventListener('input', () => { if (REC) return; if (PLAY) pause(); T = Number($('dubPos').value); seekPreview(); });
$('dub').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !DUB) return; const D = DUB, x = b.dataset.x, row = b.parentNode.id;
  if (row && /^dub(Mon|Duck|Lv|Lat|Spd)$/.test(row)) {
    const v = b.dataset.v; if (row === 'dubMon') D.mon = v; if (row === 'dubDuck') D.duck = v; if (row === 'dubLv') D.dlv = Number(v); if (row === 'dubLat') D.lat = v; if (row === 'dubSpd') D.spd = Number(v);
    if (D.take && (row === 'dubDuck' || row === 'dubLv')) { const a = P.auds.find(q => q.id === D.take); if (a) { snap(); a.duck = D.duck === 'all' ? 'none' : D.duck; a.dlv = D.dlv; P.vmute = D.duck === 'all' ? 1 : 0; changed(); } }
    renderDub(); return;
  }
  if (x === 'close') { history.back(); return; }
  if (x === 'start') { D.s = r1(T); if (D.e != null && D.e <= D.s) D.e = null; renderDub(); toast('▶ 여기서 시작', 1000); }
  if (x === 'end') { if (T <= D.s + .3) return toast('끝은 시작보다 뒤로 정해 주세요'); D.e = r1(T); renderDub(); toast('■ 여기서 끝', 1000); }
  if (x === 'noend') { D.e = null; renderDub(); }
  if (x === 'go') startRec();
  if (x === 'stop') stopRec(true);
  if (x === 'listen') { if (PLAY) { pause(); return; } T = D.s; play(); }
  if (x === 'again') { if (PLAY) pause(); undo(); D.take = null; renderDub(); setTimeout(startRec, 200); }
  if (x === 'ok') { D.take = null; history.back(); }
  if (x === 'script') { const t = $('dubTxtBox'); t.hidden = !t.hidden; if (!t.hidden) t.closest('details').open = true; }
});
if (g.BKKIT) g.BKKIT.dictate($('dubTxt'), $('dubMic'), $('dubLive'));
$('dubTxt').addEventListener('input', e => { P.script = e.target.value; clearTimeout(saveT); saveT = setTimeout(saveNow, 900); const lines = String(P.script).split('\n').map(l => l.trim()).filter(Boolean); $('dubScript').innerHTML = lines.map((l, i) => `<div class="dl" data-i="${i}">${esc(l)}</div>`).join(''); });

/* ═════════ ✨ 효과 (글자 · 스티커 · 화면 효과 · 색감 · 전환 · 효과음 · 가리기) ═════════ */
const FXTABS = [['text', '🔤 글자'], ['stk', '😀 스티커'], ['efx', '✨ 화면 효과'], ['flt', '🎨 색감'], ['tr', '🔀 전환'], ['sfx', '🔔 효과음'], ['mos', '🫥 가리기']];
let FXTAB = 'text';
function fxSheet(tab) {
  const f0 = findSel();
  if (!tab) tab = f0 && f0.type === 'text' ? 'text' : f0 && f0.type === 'fx' ? ({ stk: 'stk', efx: 'efx', sfx: 'sfx', mos: 'mos' }[f0.o.type] || FXTAB) : FXTAB;
  FXTAB = tab;
  let snapped = false; const once = () => { if (!snapped) { snap(); snapped = true; } };
  const b = sheet('✨ 효과', `<div class="fxtabs">${FXTABS.map(([k, l]) => `<button type="button" data-tab="${k}"${pressed(k, tab)}>${l}</button>`).join('')}</div><div id="fxBody"></div>`, () => {
    const before = P.texts.length; P.texts = P.texts.filter(t => t.t && t.t.trim()); if (P.texts.length !== before && SEL && SEL.type === 'text' && !P.texts.some(t => t.id === SEL.id)) SEL = null;
    changed();
  });
  const body = b.querySelector('#fxBody'), FX = g.BKFX;
  const save = () => { seekPreview(); renderTL(); clearTimeout(saveT); saveT = setTimeout(saveNow, 700); };
  const durChips = (it) => `<h4>보이는 시간</h4>${chips('dur', [[1, '1초'], [2, '2초'], [3, '3초'], [5, '5초'], ['clip', '이 장면 끝까지'], ['all', '영상 끝까지']], it.dur)}`;
  const setDur = (it, v) => { if (v === 'all') it.dur = Math.max(.5, r1(Math.max(total(), it.start + .5) - it.start)); else if (v === 'clip') { const A = clipAt(it.start); it.dur = A ? Math.max(.5, r1(A.st + clipLen(A.c) - it.start)) : 3; } else it.dur = Number(v); };
  const addFx = (o) => { once(); const it = Object.assign({ id: uid('f'), start: r1(T), dur: 3, x: .5, y: .35, size: 1 }, o); P.fx.push(it); SEL = { type: 'fx', id: it.id }; save(); return it; };
  function render() {
    const F = findSel(), it = F && F.o;
    let h = '';
    if (FXTAB === 'text') {
      let tx = F && F.type === 'text' ? it : null;
      if (!tx) { once(); tx = { id: uid('t'), t: '', start: r1(T), dur: 3, st: 'variety', size: 1, col: '', anim: '', x: .5, y: null }; P.texts.push(tx); SEL = { type: 'text', id: tx.id }; }
      h = `<textarea id="tx" placeholder="화면에 넣을 글자를 써요">${esc(tx.t)}</textarea>
        <h4>글자 모양 (13가지)</h4><div class="grid3" data-c="st">${Object.entries(FX.CAPS).map(([k, v]) => `<button type="button" data-v="${k}"${pressed(tx.st || 'basic', k)}>${esc(v.n)}</button>`).join('')}</div>
        <h4>크기</h4>${chips('size', [[.75, '작게'], [1, '보통'], [1.35, '크게'], [1.8, '아주 크게']], tx.size || 1)}
        <h4>색</h4>${chips('col', Object.entries(FX.COLORS), tx.col || '')}
        <h4>나타나는 모습</h4>${chips('anim', Object.entries(FX.ANIMS), tx.anim || '')}
        <h4>위치</h4>${chips('ypos', [['', '스타일대로'], [.16, '⬆ 위'], [.5, '가운데'], [.84, '⬇ 아래']], tx.y == null ? '' : tx.y)}
        ${durChips(tx)}
        <div class="two"><button type="button" class="big sec" data-x="newtext">＋ 새 글자</button><button type="button" class="big sec" data-x="delsel" style="color:#dc2626">🗑 지우기</button></div>
        <div class="note">빨간 선 자리부터 나와요. 미리보기 화면에서 글자를 <b>손가락으로 끌면</b> 위치가 옮겨져요.</div>`;
    } else if (FXTAB === 'stk') {
      const st = F && F.type === 'fx' && it.type === 'stk' ? it : null;
      h = `<h4>이모지 (누르면 빨간 선 자리에 들어가요)</h4><div class="emo">${FX.EMOJI.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
        <h4>배지 · 글씨 상자</h4><div class="grid3">${Object.entries(FX.BADGES).map(([k, v]) => `<button type="button" data-bd="${k}">${esc(v[0])}</button>`).join('')}</div>
        ${st ? `<h4>고른 스티커</h4>${st.b && st.b !== 'bk' ? `<input type="text" id="bdt" value="${esc(st.t || FX.BADGES[st.b][3])}" placeholder="배지 글씨">` : ''}
          <h4>크기</h4>${chips('size', [[.6, '작게'], [1, '보통'], [1.4, '크게'], [2, '아주 크게']], st.size || 1)}${durChips(st)}
          <button type="button" class="big sec" data-x="delsel" style="color:#dc2626">🗑 이 스티커 지우기</button>` : ''}
        <div class="note">넣은 스티커는 미리보기 화면에서 <b>손가락으로 끌어</b> 옮겨요.</div>`;
    } else if (FXTAB === 'efx') {
      h = `<p class="muted">누르면 <b>빨간 선 자리</b>부터 들어가요. 길이는 아래 보라 줄을 골라 📐 자르기로 바꿔요.</p>
        <div class="grid3">${Object.entries(FX.EFX).map(([k, v]) => `<button type="button" data-ef="${k}">${esc(v)}</button>`).join('')}</div>
        ${F && F.type === 'fx' && it.type === 'efx' ? `${durChips(it)}<button type="button" class="big sec" data-x="delsel" style="color:#dc2626">🗑 이 효과 지우기</button>` : ''}`;
    } else if (FXTAB === 'flt' || FXTAB === 'tr') {
      const T0 = target(true), c = T0 && T0.o;
      if (!c) h = '<div class="note">먼저 ➕ 넣기로 영상 · 사진을 넣어 주세요.</div>';
      else if (FXTAB === 'flt') h = `<p class="muted">빨간 선 아래 장면(또는 고른 장면)의 색감이 바뀌어요.</p>
        <div class="grid3" data-c="flt">${Object.entries(FX.FILTERS).map(([k, v]) => `<button type="button" data-v="${k}"${pressed(c.flt || 'none', k)}>${esc(v[0])}</button>`).join('')}</div>
        <button type="button" class="big sec" data-x="fltall">🎞 모든 장면에 같은 색감</button>`;
      else h = `<p class="muted">이 장면이 <b>들어올 때</b> 앞 장면에서 넘어가는 모습이에요.</p>
        <div class="grid3" data-c="tr">${Object.entries(FX.TRANS).map(([k, v]) => `<button type="button" data-v="${k}"${pressed(c.tr || 'cut', k)}>${esc(v)}</button>`).join('')}</div>
        <h4>넘어가는 시간</h4>${chips('td', [[.4, '빠르게'], [.6, '보통'], [1, '천천히']], c.td || .6)}
        <button type="button" class="big sec" data-x="trall">🔀 모든 장면에 같은 전환</button>`;
    } else if (FXTAB === 'sfx') {
      h = `<p class="muted">▶ 들어 보고 ＋를 누르면 <b>빨간 선 자리</b>에 들어가요. (프로그램이 만든 소리라 저작권 걱정 없어요)</p>
        ${Object.entries(FX.SFX).map(([k, v]) => `<div class="sfxrow"><button type="button" data-pv="${k}">▶</button><b>${esc(v)}</b><button type="button" class="add" data-sf="${k}">＋</button></div>`).join('')}
        ${F && F.type === 'fx' && it.type === 'sfx' ? '<button type="button" class="big sec" data-x="delsel" style="color:#dc2626">🗑 고른 효과음 지우기</button>' : ''}`;
    } else if (FXTAB === 'mos') {
      const m = F && F.type === 'fx' && it.type === 'mos' ? it : null;
      h = `<p class="muted">얼굴 · 번호판처럼 가릴 곳에 네모 무늬(모자이크)를 덮어요.</p>
        <button type="button" class="big pri" data-x="addmos">🫥 모자이크 넣기 (빨간 선 자리부터)</button>
        ${m ? `<h4>크기</h4>${chips('msz', [['s', '작게'], ['m', '보통'], ['l', '크게'], ['w', '가로로 길게']], m.sz || 'm')}
          <h4>무늬 크기</h4>${chips('px', [[.02, '촘촘'], [.035, '보통'], [.055, '굵게']], m.px || .035)}${durChips(m)}
          <button type="button" class="big sec" data-x="delsel" style="color:#dc2626">🗑 이 모자이크 지우기</button>` : ''}
        <div class="note">넣은 모자이크는 미리보기 화면에서 <b>손가락으로 끌어</b> 가릴 곳에 맞춰요.</div>`;
    }
    body.innerHTML = h;
    const tx = body.querySelector('#tx'); if (tx) { tx.addEventListener('input', () => { const F2 = findSel(); if (F2 && F2.type === 'text') { F2.o.t = tx.value; seekPreview(); } }); }
    const bdt = body.querySelector('#bdt'); if (bdt) bdt.addEventListener('input', () => { const F2 = findSel(); if (F2) { once(); F2.o.t = bdt.value; seekPreview(); } });
    renderTL();
  }
  b.addEventListener('click', async e => {
    const tb = e.target.closest('[data-tab]'); if (tb) { FXTAB = tb.dataset.tab; b.querySelectorAll('.fxtabs button').forEach(x => x.setAttribute('aria-pressed', String(x === tb))); P.texts = P.texts.filter(t => t.t && t.t.trim() || (SEL && SEL.id === t.id && FXTAB === 'text')); render(); return; }
    const F = findSel(), it = F && F.o, d = e.target.closest('button'); if (!d) return;
    if (d.dataset.e) { addFx({ type: 'stk', e: d.dataset.e, y: .3 }); render(); toast('😀 넣었어요 · 화면에서 끌어 옮겨요', 1600); return; }
    if (d.dataset.bd) { addFx({ type: 'stk', b: d.dataset.bd, y: d.dataset.bd === 'bk' ? .12 : .3, x: d.dataset.bd === 'bk' ? .85 : .5 }); render(); toast('넣었어요 · 화면에서 끌어 옮겨요', 1600); return; }
    if (d.dataset.ef) { addFx({ type: 'efx', k: d.dataset.ef, dur: FX.EFX_DUR[d.dataset.ef] || 3 }); render(); toast(FX.EFX[d.dataset.ef] + ' 넣었어요', 1400); return; }
    if (d.dataset.sf) { addFx({ type: 'sfx', k: d.dataset.sf, dur: FX.SFX_LEN[d.dataset.sf] || 1 }); render(); toast(FX.SFX[d.dataset.sf] + ' 넣었어요', 1400); return; }
    if (d.dataset.pv) { sfxPreview(d.dataset.pv); return; }
    const x = d.dataset.x;
    if (x === 'newtext') { SEL = null; render(); setTimeout(() => { const t = body.querySelector('#tx'); if (t) t.focus(); }, 100); return; }
    if (x === 'delsel' && F) { once(); F.L.splice(F.L.indexOf(it), 1); SEL = null; save(); render(); return; }
    if (x === 'addmos') { const A = clipAt(T); addFx({ type: 'mos', dur: A ? Math.max(1, r1(A.st + clipLen(A.c) - T)) : 3, w: .34, h: .2, px: .035, sz: 'm' }); render(); return; }
    if (x === 'fltall' || x === 'trall') { const c = target(true); if (!c) return; once(); for (const k of P.clips) { if (x === 'fltall') k.flt = c.o.flt; else { k.tr = c.o.tr; k.td = c.o.td; } } save(); toast('모든 장면에 적용했어요'); return; }
    if (d.parentNode.dataset.c && !d.parentNode.classList.contains('chips')) {   // 글자 모양 · 색감 · 전환 (네모 칸)
      const k = d.parentNode.dataset.c, v = d.dataset.v; once();
      d.parentNode.querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', String(z === d)));
      if (k === 'st' && F && F.type === 'text') it.st = v;
      if (k === 'flt' || k === 'tr') { const c = target(true); if (c) { c.o[k] = v; if (k === 'tr' && v !== 'cut') T = Math.max(T, itemStart(c) + .01); } }
      save(); return;
    }
  });
  onChips(b, (k, v) => {
    const F = findSel(); once();
    if (k === 'td') { const c = target(true); if (c) c.o.td = Number(v); save(); return; }
    if (!F) return; const it = F.o;
    if (k === 'dur') setDur(it, v);
    else if (k === 'col' || k === 'anim') it[k] = v;
    else if (k === 'ypos') it.y = v === '' ? null : Number(v);
    else if (k === 'msz') { it.sz = v; const S = { s: [.2, .12], m: [.34, .2], l: [.5, .32], w: [.8, .14] }[v]; it.w = S[0]; it.h = S[1]; }
    else it[k] = Number(v);
    save();
  });
  render();
}
async function sfxPreview(k) {
  try {
    const sr = 44100, oc = new OAC(2, sr * 3, sr); g.BKFX.sfx(oc, oc.destination, k, .02);
    const buf = await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const p = oc.startRendering(); if (p && p.then) p.then(res, rej); });
    if (!AC) AC = new ACx(); await AC.resume(); const s = AC.createBufferSource(); s.buffer = buf; s.connect(AC.destination); s.start();
  } catch (e) { /* 무시 */ }
}
/* 미리보기 화면에서 글자 · 스티커 · 모자이크를 손가락으로 끌어 옮기기 */
(function () {
  const cv = $('pv'); let d = null;
  const pick = () => { const F = findSel(); if (!F) return null; if (F.type === 'text' || (F.type === 'fx' && (F.o.type === 'stk' || F.o.type === 'mos'))) return F; return null; };
  cv.addEventListener('pointerdown', e => { const F = pick(); if (!F) return; if (PLAY) pause(); d = { F, moved: false }; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if (!d) return; const r = cv.getBoundingClientRect(), fx = clamp((e.clientX - r.left) / r.width, .02, .98), fy = clamp((e.clientY - r.top) / r.height, .03, .97);
    if (!d.moved) { snap(); d.moved = true; const it = d.F.o; if (T < it.start || T >= it.start + (it.dur || 0)) { T = it.start + .05; } }
    d.F.o.x = r1(fx * 100) / 100; d.F.o.y = r1(fy * 100) / 100; drawPV();
  });
  const end = () => { if (!d) return; const m = d.moved; d = null; if (m) { clearTimeout(saveT); saveT = setTimeout(saveNow, 700); seekPreview(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
})();

/* ═════════ ⚙️ 더 보기 ═════════ */
function moreSheet() {
  const f = findSel(), c = f && f.type === 'clip' ? f.o : null;
  const b = sheet('⚙️ 더 보기', `
    ${c ? `<h4>🎞 고른 장면</h4>
      ${c.kind === 'video' ? `<h4>속도</h4>${chips('speed', [[.5, '0.5배'], [1, '보통'], [1.5, '1.5배'], [2, '2배']], c.speed || 1)}` : ''}
      <h4>화면 맞춤</h4>${chips('fit', [['blur', '흐린 배경'], ['cover', '꽉 채우기'], ['contain', '전체 보이기']], c.fit || 'blur')}
      <h4>화면 페이드 (검은 화면에서 서서히)</h4>${chips('fi', [[0, '들어올 때 없음'], [.5, '0.5초'], [1, '1초']], c.fi || 0)}${chips('fo', [[0, '나갈 때 없음'], [.5, '0.5초'], [1, '1초']], c.fo || 0)}
      <h4>순서</h4><div class="two"><button type="button" class="big sec" data-x="left">◀ 앞으로</button><button type="button" class="big sec" data-x="right">뒤로 ▶</button></div>
      <button type="button" class="big sec" data-x="dup">📄 한 번 더 넣기 (복사)</button>` : '<div class="note">💡 아래 줄에서 🎞 장면을 고르면 속도 · 화면 맞춤 · 순서를 바꿀 수 있어요.</div>'}
    <h4>📱 화면 모양</h4>${chips('ratio', Object.keys(RATIOS).map(k => [k, RATIOS[k][2]]), P.ratio)}
    <h4>📷 사진 기본 길이 <small class="muted">(다음에 넣는 사진부터)</small></h4>${chips('pd', [[2, '2초'], [3, '3초'], [4, '4초'], [5, '5초']], P.photoDur)}
    <h4>📥 고른 사진 · 영상을 보관함에도 담기</h4>${chips('psave', [['ask', '매번 묻기'], ['always', '항상 담기'], ['never', '담지 않기']], (() => { try { return localStorage.getItem('bkPickSave') || 'ask'; } catch (e) { return 'ask'; } })())}
    <h4>✏️ 프로젝트 이름</h4><input type="text" id="pnm" value="${esc(P.name)}">
    <button type="button" class="big sec" data-x="bk">💾 백업 파일(.bkedit)로 저장 · ☁️ 구글 드라이브</button>
    <button type="button" class="big sec" data-x="home">📂 내 프로젝트로 나가기</button>`, () => { const v = ($('pnm') && $('pnm').value.trim()) || P.name; if (v !== P.name) { P.name = v.slice(0, 40); updBtns(); saveNow(); } });
  let snapped = false; const once = () => { if (!snapped) { snap(); snapped = true; } };
  onChips(b, (k, v) => {
    if (k === 'psave') { try { localStorage.setItem('bkPickSave', v); } catch (e) { /* 무시 */ } toast(v === 'ask' ? '매번 물어볼게요' : v === 'always' ? '항상 보관함에 담아요' : '보관함에 담지 않아요', 1400); return; }
    once();
    if (k === 'ratio') { P.ratio = v; fitCanvas(); }
    else if (k === 'pd') P.photoDur = Number(v);
    else if (k === 'fit') c.fit = v;
    else if (c) c[k] = Number(v);
    changed();
  });
  b.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'left' || x.dataset.x === 'right') { const i = P.clips.indexOf(c), j = i + (x.dataset.x === 'left' ? -1 : 1); if (j < 0 || j >= P.clips.length) return; once(); P.clips.splice(i, 1); P.clips.splice(j, 0, c); T = starts().st[j]; changed(); }
    if (x.dataset.x === 'dup') { once(); const d = Object.assign({}, c, { id: uid('c') }); P.clips.splice(P.clips.indexOf(c) + 1, 0, d); SEL = { type: 'clip', id: d.id }; changed(); closeSheet(); toast('📄 바로 뒤에 한 번 더 넣었어요'); }
    if (x.dataset.x === 'bk') { closeSheet(); await saveNow(); await backupProject(P.id); }
    if (x.dataset.x === 'home') { closeSheet(); history.back(); }
  });
}

$('tools').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  if (PLAY) pause();
  const a = b.dataset.a;
  if (a === 'add') openAdd();
  if (a === 'split') split();
  if (a === 'trim') trimSheet();
  if (a === 'del') del();
  if (a === 'sep') separate();
  if (a === 'audio') audioSheet();
  if (a === 'fx') fxSheet();
  if (a === 'more') moreSheet();
});
$('edUndo').addEventListener('click', () => { if (PLAY) pause(); undo(); });
$('edRedo').addEventListener('click', () => { if (PLAY) pause(); redo(); });
$('edRatio').addEventListener('click', () => { const ks = Object.keys(RATIOS); snap(); P.ratio = ks[(ks.indexOf(P.ratio) + 1) % ks.length]; fitCanvas(); changed(); toast(RATIOS[P.ratio][2], 1200); });
$('edName').addEventListener('click', () => { const v = prompt('프로젝트 이름', P.name); if (v && v.trim()) { P.name = v.trim().slice(0, 40); updBtns(); saveNow(); } });

/* ═════════ 💾 MP4 만들기 ═════════ */
async function pickV(W, H, fps) {
  const list = Math.min(W, H) >= 1080 ? ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032'] : ['avc1.64001f', 'avc1.4d001f', 'avc1.42e01f', 'avc1.640028'];
  const bitrate = Math.min(W, H) >= 1080 ? 8e6 : 4e6;
  for (const codec of list) { const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } }; try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) { /* 다음 */ } }
  return null;
}
async function pickA(sr) {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of [{ codec: 'mp4a.40.2', mux: 'aac', b: 160000 }, { codec: 'opus', mux: 'opus', b: 128000 }]) { const cfg = { codec: c.codec, sampleRate: sr, numberOfChannels: 2, bitrate: c.b }; try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux: c.mux }; } catch (e) { /* 다음 */ } }
  return null;
}
function exportSheet() {
  if (PLAY) pause();
  if (total() < .5) return toast('먼저 영상 · 사진을 넣어 주세요');
  const b = sheet('💾 영상 만들기', `<p>📱 화면: <b>${RATIOS[P.ratio][2]}</b> · ⏱ 길이 <b>${fmtS(total())}</b></p>
    <h4>화질</h4>${chips('q', [[720, '720 (빠르게 · 작은 파일)'], [1080, '1080 (선명하게)']], P.q || 1080)}
    <button type="button" class="big pri" id="goExp">▶ MP4 영상 만들기</button>
    <div class="note">⏳ 영상 길이의 1~3배쯤 걸려요. 만드는 동안 화면을 끄거나 다른 앱으로 가지 마세요.</div>`);
  onChips(b, (k, v) => { P.q = Number(v); });
  b.querySelector('#goExp').addEventListener('click', () => { closeSheet(); doExport(P.q || 1080); });
}
$('edExport').addEventListener('click', exportSheet);
async function doExport(q) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return toast('이 브라우저는 영상 만들기를 지원하지 않아요. 안드로이드 크롬을 써 주세요', 4000);
  const [a, bb] = RATIOS[P.ratio], k = q / Math.min(a, bb), W = Math.round(a * k / 2) * 2, H = Math.round(bb * k / 2) * 2, fps = 30, SR = 48000, tot = total();
  const ctl = { stop: false }; busy('준비 중…', 0, () => { ctl.stop = true; });
  let wl = null; try { wl = await navigator.wakeLock.request('screen'); } catch (e) { /* 없음 */ }
  try {
    try { await document.fonts.load('900 60px "Noto Sans KR"', P.texts.map(x => x.t).join('') || '가'); } catch (e) { /* 기본 글꼴 */ }
    const vcfg = await pickV(W, H, fps); if (!vcfg) throw new Error(`이 휴대폰은 ${W}x${H} 영상을 못 만들어요. 화질 720으로 해 보세요`);
    const acfg = await pickA(SR);
    const mux = new g.Mp4Muxer({ video: { width: W, height: H }, audio: acfg ? { codec: acfg.mux, sampleRate: SR, numberOfChannels: 2, bitrate: acfg.cfg.bitrate } : undefined });
    let err = null;
    if (acfg) {
      const parts = audioParts(0); busy('소리 준비 중…', 0, () => { ctl.stop = true; }); await needAudio(parts, false);
      const oc = new OAC(2, Math.max(1, Math.ceil(tot * SR)), SR), comp = oc.createDynamicsCompressor(); comp.threshold.value = -6; comp.ratio.value = 4; comp.connect(oc.destination);
      schedule(oc, comp, parts, 0, 0);
      const ab = await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const p = oc.startRendering(); if (p && p.then) p.then(res, rej); });
      const ae = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: e => { err = e; } }); ae.configure(acfg.cfg);
      const L = ab.getChannelData(0), R = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, N = ab.length, BLK = 4800;
      for (let i = 0; i < N; i += BLK) { const n = Math.min(BLK, N - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n); const au = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data: d }); ae.encode(au); au.close(); if (ae.encodeQueueSize > 16) await sleep(1); if (err) throw err; }
      await ae.flush(); ae.close(); if (err) throw err;
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { alpha: false }); x.imageSmoothingQuality = 'high';
    const ve = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => { err = e; } }); ve.configure(vcfg);
    const nF = Math.max(1, Math.round(tot * fps)), fd = Math.round(1e6 / fps), t0 = performance.now(); let lastC = null;
    try {
      for (let i = 0; i < nF; i++) {
        if (ctl.stop) throw new Error('그만했어요');
        if (err) throw err;
        const t = i / fps, A = clipAt(t);
        if (A && A.c.id !== lastC) { lastC = A.c.id; for (const s of SRC.values()) if (s.full && s.id !== A.c.src) dropFull(s); if (A.c.kind === 'image') await fullImg(SRC.get(A.c.src)); }
        if (A && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) await seekV(s.el, srcTime(A.c, A.lt)); }
        drawAt(x, W, H, t, s => s.full || s.img);
        const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: fd }); ve.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
        while (ve.encodeQueueSize > 6) await sleep(2);
        if (i % 6 === 0 || i === nF - 1) { const el = (performance.now() - t0) / 1000, p = (i + 1) / nF; busy(`🎬 영상 만드는 중… ${Math.round(p * 100)}%${p > .05 ? ` · 약 ${Math.max(1, Math.round(el / p - el))}초 남음` : ''}`, p, () => { ctl.stop = true; }); await sleep(0); }
      }
      await ve.flush(); if (err) throw err;
    } finally { try { ve.close(); } catch (e) { /* 닫힘 */ } cv.width = cv.height = 0; for (const s of SRC.values()) dropFull(s); }
    const blob = new Blob(mux.finalize(), { type: 'video/mp4' }), name = `BK에딧_${stampName()}.mp4`;
    busy(''); doneSheet(blob, name, W, H, acfg ? '' : '이 브라우저는 소리 넣기를 지원하지 않아 소리 없이 만들었어요.');
  } catch (e) { busy(''); toast('❌ ' + (e.message || e), 4000); }
  finally { try { wl && wl.release(); } catch (e) { /* 무시 */ } seekPreview(); }
}
function doneSheet(blob, name, W, H, warn) {
  const url = URL.createObjectURL(blob);
  const b = sheet('✅ 영상을 만들었어요', `<video src="${url}" controls playsinline style="width:100%;max-height:40vh;background:#000;border-radius:12px"></video>
    <p class="muted">${W}×${H} · ${(blob.size / 1048576).toFixed(1)}MB${warn ? '<br>⚠️ ' + esc(warn) : ''}</p>
    <button type="button" class="big pri" data-x="save">💾 휴대폰에 저장</button>
    <button type="button" class="big kk" data-x="share">📤 보내기 (카톡 · 유튜브 · 드라이브)</button>`, () => setTimeout(() => URL.revokeObjectURL(url), 1000));
  b.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'save') { dl(blob, name); toast('💾 저장했어요 (다운로드 폴더 · 갤러리)'); }
    if (x.dataset.x === 'share') { const r = await shareFiles([new File([blob], name, { type: 'video/mp4' })], name); if (r === 'download') toast('보내기가 안 돼서 저장했어요'); }
  });
}

/* ═════════ 백업 파일 (.bkedit) ═════════ */
async function packProject(rec) {
  const files = [], blobs = [];
  for (const m of rec.P.srcs) { const b = await IDB.get('f', m.id); if (b) { files.push({ id: m.id, size: b.size, type: b.type || m.type || '', name: m.name || '' }); blobs.push(b); } }
  const head = new TextEncoder().encode(JSON.stringify({ kind: 'bk-edit-backup', v: 1, at: Date.now(), name: rec.name, P: rec.P, cover: rec.cover || '', dur: rec.dur || 0, files }));
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, head.length, true);
  return new Blob([new TextEncoder().encode('BKEDIT01'), len, head, ...blobs], { type: 'application/octet-stream' });
}
const safeName = s => String(s || '프로젝트').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
async function backupProject(id) {
  const rec = await IDB.get('p', id); if (!rec) return;
  busy('백업 파일 만드는 중…', null, null); const blob = await packProject(rec); busy('');
  const name = `BK에딧_${safeName(rec.name)}_${stampName()}.bkedit`;
  const r = await shareFiles([new File([blob], name, { type: 'application/octet-stream' })], 'BK백업');
  if (r === 'download') toast('💾 백업 파일을 저장했어요 · 구글 드라이브 앱에서 BK백업 폴더에 올려 주세요', 4500);
}
async function backupAll() {
  const all = (await IDB.all('p')).filter(r => !r.trash); if (!all.length) return toast('백업할 프로젝트가 없어요');
  const files = [];
  for (let i = 0; i < all.length; i++) { busy(`백업 파일 만드는 중… (${i + 1}/${all.length})`, i / all.length, null); files.push(new File([await packProject(all[i])], `BK에딧_${safeName(all[i].name)}_${stampName()}.bkedit`, { type: 'application/octet-stream' })); }
  busy('');
  const r = await shareFiles(files, 'BK백업');
  if (r === 'shared') toast('☁️ 공유 화면에서 Drive → BK백업 폴더에 올려 주세요');
  if (r === 'download') toast('💾 백업 파일을 저장했어요 · 구글 드라이브 앱에서 BK백업 폴더에 올려 주세요', 4500);
}
async function openBackup(file) {
  try {
    busy('백업 파일 여는 중…', null, null);
    const magic = new TextDecoder().decode(await file.slice(0, 8).arrayBuffer());
    if (magic !== 'BKEDIT01') throw new Error('BK에딧 백업 파일이 아니에요');
    const hl = new DataView(await file.slice(8, 12).arrayBuffer()).getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(await file.slice(12, 12 + hl).arrayBuffer()));
    if (head.kind !== 'bk-edit-backup') throw new Error('BK에딧 백업 파일이 아니에요');
    let off = 12 + hl;
    for (const f of head.files) { await IDB.put('f', f.id, new Blob([file.slice(off, off + f.size)], { type: f.type })); off += f.size; }
    const p = head.P, exists = await IDB.get('p', p.id);
    if (exists) { p.id = uid('p'); p.name = (head.name || p.name) + ' (복원)'; }
    await IDB.put('p', p.id, { id: p.id, name: p.name, at: Date.now(), created: p.created || Date.now(), trash: 0, dur: head.dur || 0, cover: head.cover || '', P: p });
    busy(''); toast('📂 「' + p.name + '」을(를) 불러왔어요'); renderList();
  } catch (e) { busy(''); toast('❌ ' + (e.message || '백업 파일을 열 수 없어요'), 3500); }
}

/* ═════════ 🏠 첫 화면 · 내 프로젝트 · 휴지통 ═════════ */
let LISTTAB = 'list';
async function renderList() {
  let all = []; try { all = await IDB.all('p'); } catch (e) { /* 없음 */ }
  const want = LISTTAB === 'trash', list = all.filter(r => !!r.trash === want).sort((a, b) => (b.at || 0) - (a.at || 0));
  const day = t => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  $('projList').innerHTML = list.map(r => `<div class="pc" data-id="${esc(r.id)}"><div class="th" style="${r.cover ? `background-image:url(${r.cover})` : ''}"><i>${fmtS(r.dur || 0)}</i></div>
    <div><h3>${esc(r.name)}</h3><p>${want ? '🗑 버린 날 ' + day(r.trashedAt || r.at) : '최근 수정 ' + day(r.at)}</p><div class="acts">
    ${want ? '<button type="button" class="pri" data-a="restore">↩ 되살리기</button><button type="button" class="red" data-a="kill">완전히 지우기</button>'
      : '<button type="button" class="pri" data-a="open">✏️ 열기</button><button type="button" data-a="bk">☁️ 백업</button><button type="button" data-a="ren">이름</button><button type="button" class="red" data-a="trash">🗑</button>'}</div></div></div>`).join('')
    || `<div class="empty">${want ? '휴지통이 비어 있어요' : '아직 프로젝트가 없어요.<br>위의 <b>✂️ 자유 편집</b>을 눌러 시작해요.'}</div>`;
}
document.querySelector('.tabs2').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; LISTTAB = b.dataset.t; document.querySelectorAll('.tabs2 button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderList(); });
$('projList').addEventListener('click', async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const id = b.closest('.pc').dataset.id, rec = await IDB.get('p', id); if (!rec) return;
  const a = b.dataset.a;
  if (a === 'open') openProject(rec);
  if (a === 'bk') backupProject(id);
  if (a === 'ren') { const v = prompt('프로젝트 이름', rec.name); if (v && v.trim()) { rec.name = rec.P.name = v.trim().slice(0, 40); await IDB.put('p', id, rec); renderList(); } }
  if (a === 'trash') { rec.trash = 1; rec.trashedAt = Date.now(); await IDB.put('p', id, rec); renderList(); toast('🗑 휴지통으로 옮겼어요 (되살릴 수 있어요)'); }
  if (a === 'restore') { rec.trash = 0; await IDB.put('p', id, rec); renderList(); toast('↩ 되살렸어요'); }
  if (a === 'kill') {
    if (!confirm(`「${rec.name}」을(를) 완전히 지울까요?\n지우면 되살릴 수 없어요. (필요하면 먼저 ☁️ 백업)`)) return;
    const others = (await IDB.all('p')).filter(r => r.id !== id), used = new Set(); others.forEach(r => (r.P.srcs || []).forEach(m => used.add(m.id)));
    for (const m of rec.P.srcs || []) if (!used.has(m.id)) { try { await IDB.del('f', m.id); } catch (er) { /* 무시 */ } }
    await IDB.del('p', id); renderList(); toast('지웠어요');
  }
});
$('newFree').addEventListener('click', () => openProject(null));
$('driveAll').addEventListener('click', backupAll);
$('openBackup').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openBackup(f); });
$('reSend').addEventListener('click', () => { const c = g.BKTERMS.saved(); if (c) g.BKTERMS.send(c); else toast('아직 약관에 동의하지 않았어요'); });
$('showTerms').addEventListener('click', () => sheet('📜 이용약관', g.BKTERMS.termsHtml() + g.BKTERMS.privHtml()));

/* ═════════ 편집 화면 열기 · 닫기 ═════════ */
async function openProject(rec) {
  freeAll(); UNDO = []; REDO = []; SEL = null; T = 0;
  P = rec ? rec.P : newProject(); NEWP = !rec;
  for (const k of ['srcs', 'clips', 'auds', 'texts', 'fx']) if (!Array.isArray(P[k])) P[k] = [];
  show('editor'); document.body.classList.add('editing'); history.pushState({ ed: 1 }, '');
  if (rec) {
    for (let i = 0; i < P.srcs.length; i++) {
      busy(`불러오는 중… (${i + 1}/${P.srcs.length})`, i / P.srcs.length, null);
      const m = P.srcs[i], b = await IDB.get('f', m.id);
      if (b) { try { await loadSrc(m, b); } catch (e) { /* 열 수 없는 파일 */ } }
    }
    busy('');
    const miss = P.clips.filter(c => !SRC.has(c.src)).length + P.auds.filter(a => !SRC.has(a.src)).length;
    if (miss) toast(`⚠️ 파일 ${miss}개를 찾지 못했어요`, 3500);
  }
  fitCanvas(); updBtns(); renderTL(); seekPreview();
  OPEN_SNAP = JSON.stringify(P);
  if (!rec) { await saveNow(); setTimeout(openAdd, 300); }
}
/* ◁ 뒤로 가기 · ← : 고친 것이 있으면 저장할지 물어보기 */
let OPEN_SNAP = '', NEWP = false, IGNOREPOP = 0;
const dirty = () => !!P && JSON.stringify(P) !== OPEN_SNAP;
function leave() { IGNOREPOP = 1; closeEditor().then(() => history.back()); }
function askExit() {
  if (PLAY) pause();
  if (!dirty()) { leave(); return; }
  const b = sheet('나갈까요?', `<p class="muted">이번에 열고 나서 고친 내용이 있어요.</p>
    <button type="button" class="big pri" data-x="save">💾 저장하고 나가기</button>
    <button type="button" class="big sec" data-x="drop">🗑 저장 안 하고 나가기<br><small style="font-weight:600">이번에 고친 것은 버리고 열기 전으로 돌아가요</small></button>
    <button type="button" class="big sec" data-x="stay">✏️ 계속 편집하기</button>`);
  b.addEventListener('click', async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    sheetClose = null; $('sheet').hidden = true; $('dim').hidden = true;
    if (x.dataset.x === 'stay') return;
    if (x.dataset.x === 'drop') await discard();
    leave();
  });
}
async function discard() {
  const snapP = JSON.parse(OPEN_SNAP), keep = new Set(snapP.srcs.map(m => m.id));
  const added = P.srcs.filter(m => !keep.has(m.id)).map(m => m.id);
  let others = []; try { others = (await IDB.all('p')).filter(r => r.id !== P.id); } catch (e) { /* 없음 */ }
  const used = new Set(); others.forEach(r => ((r.P && r.P.srcs) || []).forEach(m => used.add(m.id)));
  for (const id of added) if (!used.has(id)) { try { await IDB.del('f', id); } catch (e) { /* 무시 */ } }
  if (NEWP && !snapP.clips.length) { try { await IDB.del('p', P.id); } catch (e) { /* 무시 */ } P = null; return; }
  P = snapP;
}
async function closeEditor() {
  if (PLAY) pause(); if (REC) stopRec(false); if (DUB) closeDub();
  $('sheet').hidden = true; $('dim').hidden = true; sheetClose = null;
  if (P) await saveNow(); freeAll(); P = null;
  document.body.classList.remove('editing'); show('home'); renderList();
}
$('edClose').addEventListener('click', () => { if (!$('sheet').hidden) closeSheet(); askExit(); });
window.addEventListener('popstate', () => {
  if (IGNOREPOP) { IGNOREPOP = 0; return; }
  if (DUB) { if (REC) { history.pushState({ dub: 1 }, ''); stopRec(true); return; } closeDub(); return; }
  if (P) { history.pushState({ ed: 1 }, ''); if (!$('sheet').hidden) { closeSheet(); return; } askExit(); return; }
  if (!$('sheet').hidden) { closeSheet(); history.pushState({ home: 1 }, ''); return; }
  if (!$('home').hidden) { if (confirm('BK에딧을 끌까요?')) { IGNOREPOP = 1; history.back(); } else history.pushState({ home: 1 }, ''); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && P) { if (PLAY) pause(); saveNow(); } });

/* ═════════ 시작 ═════════ */
function show(id) { ['notAdmin', 'consentPage', 'home', 'editor'].forEach(k => { $(k).hidden = k !== id; }); window.scrollTo(0, 0); }
function boot() {
  if (g.BKLIC && g.BKLIC.INAPP) { $('inapp').hidden = false; $('inappBtn').addEventListener('click', () => { if (!g.BKLIC.openChrome('')) alert('오른쪽 위 메뉴에서 「다른 브라우저로 열기」를 눌러 주세요'); }); }
  if (!g.BKE_ADMIN) { show('notAdmin'); return; }
  let just = false; try { const c = JSON.parse(localStorage.getItem('bkEditConsent') || 'null'); just = !!(c && c.ts && Date.now() - c.ts < 120000); } catch (e) { /* 무시 */ }
  if (!just && (!g.BKE_AGREED || !g.BKTERMS.saved())) { show('consentPage'); g.BKTERMS.ask($('consentBox')).then(() => location.reload()); return; }   // 방금 동의했으면 다시 묻지 않음
  show('home'); renderList();
  try { history.replaceState({ home: 0 }, ''); history.pushState({ home: 1 }, ''); } catch (e) { /* 무시 */ }
  const op = new URLSearchParams(location.search).get('open');   // 1차 편집에서 넘어온 영상 바로 열기
  if (op) { try { history.replaceState({ home: 1 }, '', './'); } catch (e) { /* 무시 */ } IDB.get('p', op).then(r => { if (r) { openProject(r); toast('✂️ 1차 편집 영상을 가져왔어요 · ✨ 효과 · 🎙 더빙을 넣어요', 3500); } }); }
}
g.BKEDIT = { get P() { return P; }, get T() { return T; }, set T(v) { T = v; seekPreview(); }, SRC, split, del, separate, undo, redo, total, clipAt, wavBlob, packProject, openBackup, renderList };
boot();
})(window);
